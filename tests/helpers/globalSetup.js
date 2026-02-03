"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = globalSetup;
const child_process_1 = require("child_process");
const CI = process.env.CI === 'true';
const KEEP_CONTAINERS = process.env.KEEP_CONTAINERS === 'true';
const SKIP_TEARDOWN = process.env.SKIP_TEARDOWN === 'true';
async function globalSetup() {
    if (CI) {
        // In GitHub Actions CI, services are handled by the workflow
        console.log('🔄 CI mode detected - skipping Docker setup');
        return;
    }
    console.log('🚀 Starting Odoo test environment...');
    try {
        // Start containers and wait for healthchecks to pass
        console.log('📦 Starting Docker containers...');
        (0, child_process_1.execSync)('docker-compose -f docker-compose.test.yml up -d --wait', {
            stdio: 'inherit',
        });
        console.log('✅ Test environment ready');
    }
    catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.error('❌ Failed to start test environment:', errorMessage);
        process.exit(1);
    }
    // Return teardown function
    return async () => {
        if (CI) {
            // CI handles cleanup via workflow
            console.log('🔄 CI mode detected - skipping cleanup');
            return;
        }
        if (KEEP_CONTAINERS) {
            console.log('🧊 Keeping containers for debugging (KEEP_CONTAINERS=true)');
            return;
        }
        if (SKIP_TEARDOWN) {
            console.log('⏭️  Skipping teardown for fast iteration (SKIP_TEARDOWN=true)');
            console.log('   Run "npm run docker:down" or "npm run docker:clean" to cleanup manually');
            return;
        }
        console.log('🧹 Cleaning up test environment...');
        try {
            (0, child_process_1.execSync)('docker-compose -f docker-compose.test.yml down -v', {
                stdio: 'inherit',
            });
            console.log('✅ Test environment cleaned up');
        }
        catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            console.warn('⚠️ Error during cleanup:', errorMessage);
            // Don't fail teardown on cleanup errors
        }
    };
}
//# sourceMappingURL=globalSetup.js.map