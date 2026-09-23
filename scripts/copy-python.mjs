import { cp, mkdir } from 'node:fs/promises'

await mkdir('public/python/aerodynamics', { recursive: true })
await cp('aerodynamics', 'public/python/aerodynamics', { recursive: true, filter: source => !source.includes('__pycache__') })

