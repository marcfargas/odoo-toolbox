"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = globalTeardown;
const child_process_1 = require("child_process");
const CI = process.env.CI === 'true';
const KEEP_CONTAINERS = process.env.KEEP_CONTAINERS === 'true';
const SKIP_TEARDOWN = process.env.SKIP_TEARDOWN === 'true';
async function globalTeardown() {
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
}
//# sourceMappingURL=globalTeardown.js.map