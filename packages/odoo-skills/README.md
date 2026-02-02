# @odoo-toolbox/skills

Claude Code SKILLs for AI agents to interact with Odoo.

## Overview

This package provides:

- **SKILL definitions** for common Odoo operations
- **Markdown generator** for Claude Code commands
- **Test infrastructure** for validating SKILL examples

## Installation

```bash
npm install @odoo-toolbox/skills
```

## Usage

### Generate Claude Code Commands

```bash
# From project root
npm run skills:generate
```

### Output Location

Los SKILLs se generan en:

```
<project-root>/.claude/commands/
├── README.md              # Índice de todos los SKILLs
├── odoo-connect.md        # Elementary: conexión
├── odoo-introspect.md     # Elementary: introspección
├── odoo-search-fields.md  # Elementary: buscar campos
├── odoo-create-lead.md    # User: crear leads
├── odoo-manage-properties.md  # Admin: propiedades
└── ...
```

### Copiar a Claude Desktop (uso global)

Para usar los SKILLs en cualquier proyecto con Claude Desktop:

**Windows (PowerShell):**
```powershell
# Copiar a Claude Desktop local
Copy-Item -Path ".\.claude\commands\*" -Destination "$env:USERPROFILE\.claude\commands\" -Recurse -Force
```

**macOS/Linux:**
```bash
# Copiar a Claude Desktop local
cp -r .claude/commands/* ~/.claude/commands/
```

**Script npm (añadir a package.json si lo deseas):**
```json
{
  "scripts": {
    "skills:install": "npm run skills:generate && cp -r .claude/commands/* ~/.claude/commands/"
  }
}
```

> **Nota**: Los comandos en `~/.claude/commands/` están disponibles globalmente.
> Los comandos en `<proyecto>/.claude/commands/` solo están disponibles en ese proyecto.

### Configuración de Credenciales Odoo

Los SKILLs necesitan credenciales para conectar con Odoo. Hay varias opciones:

#### Opción 1: Archivo `.odoo.env` en el proyecto (Recomendado)

Crea un archivo `.odoo.env` en la raíz de tu proyecto:

```bash
# .odoo.env - Credenciales de Odoo (añadir a .gitignore!)
ODOO_URL=http://localhost:8069
ODOO_DB=mi_base_datos
ODOO_USER=admin
ODOO_PASSWORD=mi_password_seguro
```

> **Importante**: Añade `.odoo.env` a tu `.gitignore` para no commitear credenciales.

#### Opción 2: Variables de entorno del sistema

**Windows (PowerShell - sesión actual):**
```powershell
$env:ODOO_URL = "http://localhost:8069"
$env:ODOO_DB = "mi_base_datos"
$env:ODOO_USER = "admin"
$env:ODOO_PASSWORD = "mi_password"
```

**Windows (permanente):**
```powershell
[System.Environment]::SetEnvironmentVariable("ODOO_URL", "http://localhost:8069", "User")
[System.Environment]::SetEnvironmentVariable("ODOO_DB", "mi_base_datos", "User")
[System.Environment]::SetEnvironmentVariable("ODOO_USER", "admin", "User")
[System.Environment]::SetEnvironmentVariable("ODOO_PASSWORD", "mi_password", "User")
```

**macOS/Linux:**
```bash
# Añadir a ~/.bashrc o ~/.zshrc
export ODOO_URL="http://localhost:8069"
export ODOO_DB="mi_base_datos"
export ODOO_USER="admin"
export ODOO_PASSWORD="mi_password"
```

#### Opción 3: Archivo CLAUDE.md del proyecto

Incluye las credenciales (sin password) en el archivo `CLAUDE.md` de tu proyecto:

```markdown
## Odoo Configuration

Este proyecto conecta con Odoo:
- URL: http://localhost:8069
- Database: mi_base_datos
- User: admin
- Password: (usar variable de entorno ODOO_PASSWORD)
```

#### Variables de entorno soportadas

| Variable | Descripción | Ejemplo |
|----------|-------------|---------|
| `ODOO_URL` | URL del servidor Odoo | `http://localhost:8069` |
| `ODOO_DB` o `ODOO_DATABASE` | Nombre de la base de datos | `odoo` |
| `ODOO_USER` o `ODOO_USERNAME` | Usuario de Odoo | `admin` |
| `ODOO_PASSWORD` | Contraseña | `admin` |

### Use in Code

```typescript
import { skillRegistry, generateSkill } from '@odoo-toolbox/skills';

// Get all skills
const skills = skillRegistry.skills;

// Get skill by ID
const connectSkill = skillRegistry.get('odoo-connect');

// Get skills by level
const elementarySkills = skillRegistry.getByLevel('elementary');

// Generate markdown for a skill
const markdown = generateSkill(connectSkill);
```

## SKILL Categories

### Elementary (Getting Started)

- `odoo-connect` - Connect and authenticate with Odoo
- `odoo-introspect` - Discover models and fields
- `odoo-search-fields` - Search for fields by pattern
- `odoo-search-translations` - Find translated strings
- `odoo-explore-modules` - List available modules

### User (Business Operations)

- `odoo-create-lead` - Create CRM leads
- `odoo-search-partners` - Search contacts and companies

### Admin (Configuration)

- `odoo-install-module` - Install Odoo modules
- `odoo-manage-properties` - Define dynamic properties fields

## Testing

```bash
# Unit tests
npm run test

# Integration tests (requires Docker)
npm run test:integration
```

## Development

### Adding a New SKILL

1. Create a new file in `src/definitions/{level}/`:

```typescript
// src/definitions/user/my-skill.skill.ts
import { SkillDefinition } from '../../types';

export const mySkill: SkillDefinition = {
  id: 'odoo-my-skill',
  shortName: 'my-skill',
  title: 'My Skill',
  summary: 'Brief description',
  description: `Detailed description...`,
  level: 'user',
  category: 'crm',
  parameters: [],
  moduleDependencies: [],
  odooModels: [],
  examples: [
    {
      title: 'Example',
      description: 'What this example shows',
      code: `// TypeScript code here`,
      tested: true,
    },
  ],
  relatedSkills: [],
  odooReferences: [],
  tags: [],
};
```

2. Export from index file
3. Add to registry
4. Run `npm run skills:generate`

## License

LGPL-3.0
