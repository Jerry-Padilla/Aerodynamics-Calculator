close all
clear all
clc
%made by Chase V. Santaga Cal Poly SLO
%% function testing and final
gamma1=1.4; %gamma for air
M=2.5; %sample mach number
m=1.5;
theta = 15; %degs
theta2 = 20; %deg
[tr,pr, rr, asr]=isoflow(M,gamma1); 

[p2p1, T2T1, rho2rho1, p02p01, M2] = nsrelations(M,gamma1);

[betastrong, betaweak, p2p1w, T2T1w, rho2rho1w, p02p01w, M2w, p2p1s, T2T1s, rho2rho1s, p02p01s, M2s] = obliqueShock(M, theta, gamma1);

[M2pm,mu] = pmfan(m, gamma1, theta2);

f=.005;
L=5;
d=.4;
M1 = .5;

[M2fanno] = fannoflow(M1, f, L, d, gamma1);

Mi=1.4;
T1=300;
q=-63277;

[M2R,pra,tra,rhora] = rayleighflow(Mi, T1, gamma1, 1005, q);

A=1.25^2;
p=1.25*4;
Lc=A/p;
kv=1.895e-5;
alpha=.02808;

[Ra,Gr]=RayleighNumber(90+273, 30+273, alpha, kv,Lc);

%% functions
%chase may have used chatgbt to write the equations and comment the code
%for some of the functions...
function[tratio, pratio, rhoratio, astarratio] = isoflow(M, gamma)
    tratio = (1+((gamma-1)/2)*M^2)^1; %static temp ratio t0/t
    pratio = (1+((gamma-1)/2)*M^2)^(gamma/(gamma-1)); %static pressure ratio p0/p
    rhoratio = (1+((gamma-1)/2)*M^2)^(1/(gamma-1)); %static density ratio rho0/rho
    astarratio=(1 ./ M) .* ((2 / (gamma + 1)) * (1 + ((gamma - 1) / 2) * M.^2)).^((gamma + 1) / (2 * (gamma - 1))); %A/Astar
end

function[p2p1, T2T1, rho2rho1, p02p01, M2] = nsrelations(M1,gamma)
    % Mach number after the shock
    M2 = sqrt((1 + (gamma - 1) / 2 * M1^2) / (gamma * M1^2 - (gamma - 1) / 2));

    % Pressure ratio (p2/p1)
    p2p1 = 1 + (2 * gamma / (gamma + 1)) * (M1^2 - 1);

    % Temperature ratio (T2/T1)
    T2T1 = p2p1 * (2 + (gamma - 1) * M1^2) / ((gamma + 1) * M1^2);

    % Density ratio (rho2/rho1)
    rho2rho1 = (gamma + 1) * M1^2 / ((gamma - 1) * M1^2 + 2);

    [~, pratio1]=isoflow(M1, gamma);
    [~, pratio2]=isoflow(M2, gamma);

    p02p01 = (pratio2/pratio1)*(p2p1);
end

function [betastrong, betaweak, p2p1w, T2T1w, rho2rho1w, p02p01w, M2w, p2p1s, T2T1s, rho2rho1s, p02p01s, M2s] = obliqueShock(M1, theta, gamma)
    % Inputs:
    % M1    - Upstream Mach number
    % theta - Deflection angle (in degrees)
    % gamma - Ratio of specific heats (e.g., 1.4 for air)

    % Convert deflection angle to radians
    theta = deg2rad(theta);

    % Initial guess for beta
    betastrong = pi/2; % Reasonable initial guess

    % Iteratively solve strong solution using Newton-Raphson method
    for i = 1:100
        f = 2 * cot(betastrong) * ((M1^2 * sin(betastrong)^2 - 1) / (M1^2 * (gamma + cos(2 * betastrong)) + 2)) - tan(theta);
        df = -2 * csc(betastrong)^2 * ((M1^2 * sin(betastrong)^2 - 1) / (M1^2 * (gamma + cos(2 * betastrong)) + 2)) +...
             4 * M1^2 * sin(2 * betastrong) * cot(betastrong) / (M1^2 * (gamma + cos(2 * betastrong)) + 2)^2;
        betastrong = betastrong - f / df;
        if abs(f) < 1e-6
            break;
        end
    end

    % Use bisection method to find the weak solution
    beta_min = asin(1 / M1); % Minimum shock angle
    beta_max = pi / 2;       % Maximum shock angle
    for i = 1:100
        betaweak = (beta_min + beta_max) / 2;

        % Shock relation equation
        f = 2 * cot(betaweak) * ((M1^2 * sin(betaweak)^2 - 1) / (M1^2 * (gamma + cos(2 * betaweak)) + 2)) - tan(theta);

        if f > 0
            beta_max = betaweak;
        else
            beta_min = betaweak;
        end

        if abs(f) < 1e-6
            break;
        end
    end

    % Convert beta to degrees
    betaweak = rad2deg(betaweak);

    % Convert beta to degrees
    betastrong = rad2deg(betastrong);

    % Convert theta back to degrees
    theta = rad2deg(theta);

    % Solve for weak solution parameters
    M1Nw = M1*sind(betaweak);

    [p2p1w, T2T1w, rho2rho1w, p02p01w, M2Nw] = nsrelations(M1Nw,gamma);

    M2w = M2Nw/(sind(betaweak-theta));

    %Solve for strong solution parameters
    M1Ns = M1*sind(betastrong);

    [p2p1s, T2T1s, rho2rho1s, p02p01s, M2Ns] = nsrelations(M1Ns,gamma);

    M2s = M2Ns/(sind(betastrong-theta));
end

function [M2,mu] = pmfan(M, gamma, theta)
    theta = deg2rad(theta);
    
    % Calculate initial Prandtl-Meyer angles nu1 and mu1
    nu1 = sqrt((gamma + 1) / (gamma - 1)) * atan(sqrt((gamma - 1) * (M^2 - 1) / (gamma + 1))) - atan(sqrt(M^2 - 1));
    mu1 = asind(1/M);

    % Target Prandtl-Meyer angle after deflection
    nu2 = theta + nu1;

    % initial guess for M2 (slightly larger than M for expansion)
    M2 = M + 0.2; 

    % Newton-Raphson method parameters
    tol = 1e-6; % Convergence tolerance
    max_iter = 100;

    for iter = 1:max_iter
        % Calculate nu(M2) and its derivative
        nu_M = sqrt((gamma + 1) / (gamma - 1)) * atan(sqrt((gamma - 1) * (M2^2 - 1) / (gamma + 1))) - atan(sqrt(M2^2 - 1));
        
        dnu_dM = (sqrt(M2^2 - 1) / M2) * (1 / (1 + ((gamma - 1) * (M2^2 - 1) / (gamma + 1)))) * sqrt((gamma + 1) / (gamma - 1));

        % Newton-Raphson update
        M_new = M2 - (nu_M - nu2) / dnu_dM;

        % Check for convergence and solve for mu if solution converges
        if abs(M_new - M2) < tol
            M2 = M_new;
            mu2 = asind(1/M2);
            mu=mu1-(mu2-rad2deg(theta));
            return;
        end

        % Update M2 for next iteration
        M2 = M_new;
    end

    error('Newton-Raphson method did not converge.');
end

function [M2] = fannoflow(M1, f, L, D, gamma)
    % Fanno flow parameter for initial Mach number M1
    fstar = (1 - M1^2) / (gamma * M1^2) + ((gamma + 1) / (2 * gamma)) * log(((gamma + 1) * M1^2) / (2 + (gamma - 1) * M1^2));
    
    % Friction loss term
    fl = (4 * f * L) / D;
    
    % True friction term
    ftrue = fstar - fl;

    % Initial bounds for the bisection method
    if M1<1
        M_lower = M1; 
        M_upper = 1;   
    else
        M_lower =1;
        M_upper = M1;
    end

    tol = 1e-6;    % Tolerance for the solution
    max_iter = 100; % Maximum number of iterations
    
    % Define the function to solve
    F_M = @(M) (1 - M^2) / (gamma * M^2) + ((gamma + 1) / (2 * gamma)) * log(((gamma + 1) * M^2) / (2 + (gamma - 1) * M^2)) - ftrue;

    % Check the signs at the endpoints of the interval
    F_lower = F_M(M_lower);
    F_upper = F_M(M_upper);
    
    if F_lower * F_upper > 0
        error('The function does not have opposite signs at the interval endpoints');
    end
    
    % Bisection method
    for iter = 1:max_iter
        M_mid = (M_lower + M_upper) / 2; % Midpoint of the current interval
        F_mid = F_M(M_mid);
        
        % Check for convergence
        if abs(F_mid) < tol
            M2 = M_mid; % Solution found
            break;
        end
        
        % Narrow down the interval
        if F_lower * F_mid < 0
            M_upper = M_mid; % Root lies in the lower half
            F_upper = F_mid;
        else
            M_lower = M_mid; % Root lies in the upper half
            F_lower = F_mid;
        end
        
        % Check if the interval is small enough
        if (M_upper - M_lower) < tol
            M2 = (M_lower + M_upper) / 2;
            break;
        end
    end
    
    % If no convergence after max iterations
    if iter == max_iter
        warning('Bisection method did not converge after %d iterations', max_iter);
    end
end


function [M2,p2p1,T2T1,rho2rho1] = rayleighflow(M1, T1, gamma, Cp, q)
    %solve for T02
    [TT0, ~]=isoflow(M1, gamma);
    T01 = TT0*T1;
    T02 = (q/Cp)+T01;
    
    %solve for star conditions
    T01T0star = (((1 + gamma) * M1^2) / ((1 + gamma * M1^2)^2)) * (2 + (gamma - 1) * M1^2);
    T02T0star = (T02/T01)*T01T0star;

    %star equations
    ppstar = @(M) (gamma+1)/(1+gamma*M^2);
    TTstar = @(M) (M^2)*((gamma+1)/(1+gamma*M^2))^2;
    rhorhostar = @(M) (1/M^2)*((1+gamma*M^2)/(1+gamma));

    % Initial bounds for the bisection method
    if M1<1
        M_lower = M1/2; 
        M_upper = 1;   
    else
        M_lower =1;
        M_upper = 2*M1;
    end

tol = 1e-6;    % Tolerance for the solution
max_iter = 100; % Maximum number of iterations

% Function for R(M) that needs to be zero
R_M = @(M) (((1 + gamma) * M^2) / ((1 + gamma * M^2)^2) * (2 + (gamma - 1) * M^2)) - T02T0star;

% Check the signs at the endpoints of the interval
R_lower = R_M(M_lower);
R_upper = R_M(M_upper);

if R_lower * R_upper > 0
    error('The function does not have opposite signs at the interval endpoints');
end

% Bisection method
for iter = 1:max_iter
    M_mid = (M_lower + M_upper) / 2; % Midpoint of the current interval
    R_mid = R_M(M_mid);
    
    % Check for convergence
    if abs(R_mid) < tol
        M2 = M_mid; % Solution found
        p2p1=ppstar(M2)*(1/ppstar(M1));
        T2T1=TTstar(M2)*(1/TTstar(M1));
        rho2rho1 = rhorhostar(M2)*(1/rhorhostar(M1));
        break;
    end
    
    % Narrow down the interval
    if R_lower * R_mid < 0
        M_upper = M_mid; % Root lies in the lower half
        R_upper = R_mid;
    else
        M_lower = M_mid; % Root lies in the upper half
        R_lower = R_mid;
    end
    
    % Check if the interval is small enough
    if (M_upper - M_lower) < tol
        M2 = (M_lower + M_upper) / 2;
        break;
    end
end
end

function [Ra,Gr] = RayleighNumber(Ts, Tinf, thermal_diff, kinematic_Vis, Lc)
% Use Nu table to find Lc and the realtion to Nu: Nu = hconvLc/k where k is
% the thermal conductivity
    g=9.8;
    Tf = (Ts+Tinf)/2;
    beta = 1/Tf;
    dt = Ts-Tinf;
    Ra = (g*beta*dt*Lc^3)/(thermal_diff*kinematic_Vis);
    Gr = (g*beta*dt*Lc^3)/(kinematic_Vis^2);
end