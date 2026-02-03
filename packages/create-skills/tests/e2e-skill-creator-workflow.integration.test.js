"use strict";
/**
 * E2E Test: Skill Creator Workflow
 *
 * This test validates the CLI creates projects correctly:
 * 1. Use CLI to create a skills project
 * 2. Verify all files and modules are present (matching assets/)
 * 3. Run validation command
 * 4. Verify template content
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
const vitest_1 = require("vitest");
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const os = __importStar(require("os"));
const child_process_1 = require("child_process");
(0, vitest_1.describe)('E2E: Skill Creator Workflow', () => {
    let tempWorkspace;
    let projectDir;
    const cliPath = path.resolve(__dirname, '..', 'dist', 'cli', 'cli.js');
    const assetsDir = path.resolve(__dirname, '..', 'assets');
    (0, vitest_1.beforeAll)(() => {
        // Create temp workspace
        tempWorkspace = fs.mkdtempSync(path.join(os.tmpdir(), 'odoo-skills-test-'));
        projectDir = path.join(tempWorkspace, 'test-skills');
    });
    (0, vitest_1.afterAll)(() => {
        // Cleanup
        if (tempWorkspace && fs.existsSync(tempWorkspace)) {
            fs.rmSync(tempWorkspace, { recursive: true, force: true });
        }
    });
    (0, vitest_1.describe)('Step 1: Create skills project with CLI', () => {
        (0, vitest_1.it)('should create project with CLI', () => {
            // Run CLI to create project
            const result = (0, child_process_1.execSync)(`node "${cliPath}" test-skills --no-git`, {
                cwd: tempWorkspace,
                encoding: 'utf-8',
            });
            (0, vitest_1.expect)(result).toContain('Created project structure');
            (0, vitest_1.expect)(result).toContain('Installed base modules');
            (0, vitest_1.expect)(fs.existsSync(projectDir)).toBe(true);
        });
        (0, vitest_1.it)('should have all required files', () => {
            const requiredFiles = [
                'SKILL.md',
                'AGENTS.md',
                'README.md',
                'package.json',
                '.env.example',
                '.gitignore',
            ];
            for (const file of requiredFiles) {
                const filePath = path.join(projectDir, file);
                (0, vitest_1.expect)(fs.existsSync(filePath), `Missing: ${file}`).toBe(true);
            }
        });
        (0, vitest_1.it)('should have all base modules from assets', () => {
            const assetsBase = path.join(assetsDir, 'initial', 'base');
            const projectBase = path.join(projectDir, 'base');
            (0, vitest_1.expect)(fs.existsSync(projectBase)).toBe(true);
            // Dynamically get modules from assets/initial/base
            const assetModules = fs.readdirSync(assetsBase).filter((f) => f.endsWith('.md'));
            (0, vitest_1.expect)(assetModules.length).toBeGreaterThan(0);
            for (const mod of assetModules) {
                const modPath = path.join(projectBase, mod);
                (0, vitest_1.expect)(fs.existsSync(modPath), `Missing: base/${mod}`).toBe(true);
            }
        });
        (0, vitest_1.it)('should have skills directory', () => {
            const skillsDir = path.join(projectDir, 'skills');
            (0, vitest_1.expect)(fs.existsSync(skillsDir)).toBe(true);
        });
    });
    (0, vitest_1.describe)('Step 2: Validate project with CLI', () => {
        (0, vitest_1.it)('should pass validation', () => {
            const result = (0, child_process_1.execSync)(`node "${cliPath}" validate`, {
                cwd: projectDir,
                encoding: 'utf-8',
            });
            (0, vitest_1.expect)(result).toContain('Validating skills');
            (0, vitest_1.expect)(result).toContain('valid');
            (0, vitest_1.expect)(result).not.toContain('Error');
        });
    });
    (0, vitest_1.describe)('Step 3: SKILL.md router content', () => {
        (0, vitest_1.it)('should have prerequisites section', () => {
            const skillMdPath = path.join(projectDir, 'SKILL.md');
            const content = fs.readFileSync(skillMdPath, 'utf-8');
            (0, vitest_1.expect)(content).toContain('Prerequisites');
            (0, vitest_1.expect)(content).toContain('connection.md');
            (0, vitest_1.expect)(content).toContain('field-types.md');
            (0, vitest_1.expect)(content).toContain('domains.md');
        });
        (0, vitest_1.it)('should list additional modules', () => {
            const skillMdPath = path.join(projectDir, 'SKILL.md');
            const content = fs.readFileSync(skillMdPath, 'utf-8');
            (0, vitest_1.expect)(content).toContain('introspection');
            (0, vitest_1.expect)(content).toContain('crud');
            (0, vitest_1.expect)(content).toContain('search');
            (0, vitest_1.expect)(content).toContain('properties');
            (0, vitest_1.expect)(content).toContain('modules');
        });
        (0, vitest_1.it)('should have project name substituted', () => {
            const skillMdPath = path.join(projectDir, 'SKILL.md');
            const content = fs.readFileSync(skillMdPath, 'utf-8');
            (0, vitest_1.expect)(content).toContain('test-skills');
            (0, vitest_1.expect)(content).not.toContain('{{PROJECT_NAME}}');
        });
    });
    (0, vitest_1.describe)('Step 4: Base module content', () => {
        (0, vitest_1.it)('connection.md should have connection patterns', () => {
            const connPath = path.join(projectDir, 'base', 'connection.md');
            const content = fs.readFileSync(connPath, 'utf-8');
            (0, vitest_1.expect)(content).toContain('OdooClient');
            (0, vitest_1.expect)(content).toContain('authenticate');
            (0, vitest_1.expect)(content).toContain('ODOO_URL');
        });
        (0, vitest_1.it)('field-types.md should document field types', () => {
            const ftPath = path.join(projectDir, 'base', 'field-types.md');
            const content = fs.readFileSync(ftPath, 'utf-8');
            (0, vitest_1.expect)(content).toContain('char');
            (0, vitest_1.expect)(content).toContain('many2one');
            (0, vitest_1.expect)(content).toContain('Read/Write');
        });
        (0, vitest_1.it)('domains.md should document domain syntax', () => {
            const domPath = path.join(projectDir, 'base', 'domains.md');
            const content = fs.readFileSync(domPath, 'utf-8');
            (0, vitest_1.expect)(content).toContain('=');
            (0, vitest_1.expect)(content).toContain('ilike');
            (0, vitest_1.expect)(content).toContain('search');
        });
        (0, vitest_1.it)('skill-generation.md should have workflow', () => {
            const sgPath = path.join(projectDir, 'base', 'skill-generation.md');
            const content = fs.readFileSync(sgPath, 'utf-8');
            (0, vitest_1.expect)(content).toContain('SKILL Format');
            (0, vitest_1.expect)(content).toContain('Step');
            (0, vitest_1.expect)(content).toContain('introspect');
        });
    });
});
//# sourceMappingURL=e2e-skill-creator-workflow.integration.test.js.map