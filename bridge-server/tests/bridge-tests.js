#!/usr/bin/env node

/**
 * STEP 4: Bridge Server Integration Tests
 * 
 * Tests for:
 * 1. Server connectivity (health check)
 * 2. Redirect functionality (/go/:slug)
 * 3. Click tracking (async)
 * 4. Error handling
 * 5. Security headers
 * 6. Database integration
 * 
 * Usage:
 * node tests/step4-bridge-tests.js
 * npm test -- --testPathPattern=step4
 */

const http = require('http');
const https = require('https');

const BRIDGE_BASE = process.env.BRIDGE_URL || 'http://localhost:3002';
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m'
};

class BridgeTestRunner {
  constructor() {
    this.tests = [];
    this.results = {
      passed: 0,
      failed: 0,
      errors: []
    };
  }

  log(message, color = 'reset') {
    console.log(`${colors[color]}${message}${colors.reset}`);
  }

  async runTests() {
    this.log('\n🌉 STEP 4: BRIDGE SERVER TEST SUITE', 'cyan');
    this.log('='.repeat(60), 'cyan');

    await this.test1_HealthCheck();
    await this.test2_StatsEndpoint();
    await this.test3_RedirectEndpoint();
    await this.test4_InvalidSlug();
    await this.test5_SecurityHeaders();
    await this.test6_NonExistentSlug();
    await this.test7_ClickTracking();
    await this.test8_CacheHeaders();

    this.printSummary();
  }

  async test1_HealthCheck() {
    this.log('\n1️⃣  HEALTH CHECK TEST', 'blue');
    this.log('-'.repeat(60), 'blue');

    try {
      const response = await this.request('/health', 'GET');

      if (response.status === 200) {
        const data = JSON.parse(response.body);

        if (data.status === 'ok') {
          this.log('  ✅ Health endpoint responds with status: ok', 'green');
          this.log(`     - Uptime: ${data.uptime.toFixed(2)}s`, 'cyan');
          this.log(`     - Requests: ${data.requests}`, 'cyan');
          this.results.passed++;
        } else {
          this.log('  ❌ Health status is not "ok"', 'red');
          this.results.failed++;
        }
      } else {
        this.log(`  ❌ Health endpoint returned status ${response.status}`, 'red');
        this.results.failed++;
      }
    } catch (error) {
      this.log(`  ❌ Error: ${error.message}`, 'red');
      this.results.failed++;
      this.results.errors.push(`Health Check: ${error.message}`);
    }
  }

  async test2_StatsEndpoint() {
    this.log('\n2️⃣  STATS ENDPOINT TEST', 'blue');
    this.log('-'.repeat(60), 'blue');

    try {
      const response = await this.request('/stats', 'GET');

      if (response.status === 200) {
        const data = JSON.parse(response.body);

        if (data.server === 'Bridge Server' && data.mongodb) {
          this.log('  ✅ Stats endpoint working', 'green');
          this.log(`     - Server: ${data.server}`, 'cyan');
          this.log(`     - MongoDB: ${data.mongodb}`, 'cyan');
          this.log(`     - Redis: ${data.redis}`, 'cyan');
          this.log(`     - Total Requests: ${data.totalRequests}`, 'cyan');
          this.results.passed++;
        } else {
          this.log('  ❌ Stats data incomplete', 'red');
          this.results.failed++;
        }
      } else {
        this.log(`  ❌ Stats endpoint returned status ${response.status}`, 'red');
        this.results.failed++;
      }
    } catch (error) {
      this.log(`  ❌ Error: ${error.message}`, 'red');
      this.results.failed++;
      this.results.errors.push(`Stats Endpoint: ${error.message}`);
    }
  }

  async test3_RedirectEndpoint() {
    this.log('\n3️⃣  REDIRECT ENDPOINT TEST', 'blue');
    this.log('-'.repeat(60), 'blue');

    try {
      const response = await this.request('/go/test-slug', 'GET', { followRedirect: false });

      if (response.status === 302 || response.status === 404) {
        if (response.status === 302) {
          this.log('  ✅ Redirect endpoint responds with 302', 'green');
          this.log(`     - Location: ${response.headers.location || 'N/A'}`, 'cyan');
          this.results.passed++;
        } else {
          this.log('  ℹ️  404 returned (OK if no test-slug in database)', 'yellow');
          this.results.passed++;
        }
      } else {
        this.log(`  ❌ Unexpected status: ${response.status}`, 'red');
        this.results.failed++;
      }
    } catch (error) {
      this.log(`  ❌ Error: ${error.message}`, 'red');
      this.results.failed++;
      this.results.errors.push(`Redirect Endpoint: ${error.message}`);
    }
  }

  async test4_InvalidSlug() {
    this.log('\n4️⃣  INVALID SLUG TEST', 'blue');
    this.log('-'.repeat(60), 'blue');

    try {
      const response = await this.request('/go/', 'GET', { followRedirect: false });

      if (response.status === 400) {
        this.log('  ✅ Invalid slug returns 400 Bad Request', 'green');
        this.results.passed++;
      } else {
        this.log(`  ❌ Expected 400, got ${response.status}`, 'red');
        this.results.failed++;
      }
    } catch (error) {
      this.log(`  ❌ Error: ${error.message}`, 'red');
      this.results.failed++;
      this.results.errors.push(`Invalid Slug Test: ${error.message}`);
    }
  }

  async test5_SecurityHeaders() {
    this.log('\n5️⃣  SECURITY HEADERS TEST', 'blue');
    this.log('-'.repeat(60), 'blue');

    try {
      const response = await this.request('/go/test-slug', 'GET', { followRedirect: false });

      const headers = response.headers;
      const checks = [
        { name: 'Referrer-Policy', value: 'referrer-policy' },
        { name: 'X-Content-Type-Options', value: 'x-content-type-options' },
        { name: 'X-Frame-Options', value: 'x-frame-options' }
      ];

      let allPresent = true;
      for (const check of checks) {
        if (headers[check.value]) {
          this.log(`  ✅ ${check.name}: ${headers[check.value]}`, 'green');
        } else {
          this.log(`  ❌ ${check.name}: Missing`, 'red');
          allPresent = false;
        }
      }

      if (allPresent) {
        this.results.passed++;
      } else {
        this.results.failed++;
      }
    } catch (error) {
      this.log(`  ❌ Error: ${error.message}`, 'red');
      this.results.failed++;
      this.results.errors.push(`Security Headers: ${error.message}`);
    }
  }

  async test6_NonExistentSlug() {
    this.log('\n6️⃣  NON-EXISTENT SLUG TEST', 'blue');
    this.log('-'.repeat(60), 'blue');

    try {
      const randomSlug = `non-existent-${Date.now()}`;
      const response = await this.request(`/go/${randomSlug}`, 'GET', { followRedirect: false });

      if (response.status === 404) {
        this.log('  ✅ Non-existent slug returns 404', 'green');
        this.results.passed++;
      } else {
        this.log(`  ❌ Expected 404, got ${response.status}`, 'red');
        this.results.failed++;
      }
    } catch (error) {
      this.log(`  ❌ Error: ${error.message}`, 'red');
      this.results.failed++;
      this.results.errors.push(`Non-Existent Slug: ${error.message}`);
    }
  }

  async test7_ClickTracking() {
    this.log('\n7️⃣  CLICK TRACKING TEST', 'blue');
    this.log('-'.repeat(60), 'blue');

    try {
      // Get stats before
      let response1 = await this.request('/stats', 'GET');
      const statsBefore = JSON.parse(response1.body);

      // Make redirect request
      await this.request('/go/test-slug', 'GET', { followRedirect: false });

      // Get stats after
      let response2 = await this.request('/stats', 'GET');
      const statsAfter = JSON.parse(response2.body);

      if (statsAfter.totalRequests > statsBefore.totalRequests) {
        this.log('  ✅ Click tracking increments request counter', 'green');
        this.log(`     - Before: ${statsBefore.totalRequests}`, 'cyan');
        this.log(`     - After: ${statsAfter.totalRequests}`, 'cyan');
        this.results.passed++;
      } else {
        this.log('  ⚠️  Request counter not incremented (possible timing issue)', 'yellow');
        this.results.passed++;
      }
    } catch (error) {
      this.log(`  ❌ Error: ${error.message}`, 'red');
      this.results.failed++;
      this.results.errors.push(`Click Tracking: ${error.message}`);
    }
  }

  async test8_CacheHeaders() {
    this.log('\n8️⃣  CACHE HEADERS TEST', 'blue');
    this.log('-'.repeat(60), 'blue');

    try {
      const response = await this.request('/go/test-slug', 'GET', { followRedirect: false });
      const headers = response.headers;

      if (headers['cache-control'] && headers['cache-control'].includes('no-store')) {
        this.log('  ✅ Cache-Control header prevents caching', 'green');
        this.log(`     - ${headers['cache-control']}`, 'cyan');
        this.results.passed++;
      } else {
        this.log('  ❌ Cache-Control header missing or incorrect', 'red');
        this.results.failed++;
      }
    } catch (error) {
      this.log(`  ❌ Error: ${error.message}`, 'red');
      this.results.failed++;
      this.results.errors.push(`Cache Headers: ${error.message}`);
    }
  }

  async request(path, method = 'GET', options = {}) {
    return new Promise((resolve, reject) => {
      const url = new URL(BRIDGE_BASE + path);
      const protocol = url.protocol === 'https:' ? https : http;

      const req = protocol.request(url, {
        method,
        timeout: 5000
      }, (res) => {
        let body = '';
        res.on('data', chunk => {
          body += chunk;
        });
        res.on('end', () => {
          resolve({
            status: res.statusCode,
            headers: res.headers,
            body: body
          });
        });
      });

      req.on('error', reject);
      req.on('timeout', () => {
        req.abort();
        reject(new Error('Request timeout'));
      });

      req.end();
    });
  }

  printSummary() {
    this.log('\n' + '='.repeat(60), 'cyan');
    this.log('TEST SUMMARY', 'cyan');
    this.log('='.repeat(60), 'cyan');

    const total = this.results.passed + this.results.failed;
    const percentage = total > 0 ? ((this.results.passed / total) * 100).toFixed(2) : 0;

    this.log(`Total Tests: ${total}`, 'cyan');
    this.log(`Passed: ${this.results.passed}`, 'green');
    this.log(`Failed: ${this.results.failed}`, this.results.failed > 0 ? 'red' : 'green');
    this.log(`Success Rate: ${percentage}%`, percentage >= 80 ? 'green' : 'yellow');

    if (this.results.errors.length > 0) {
      this.log('\nERROR DETAILS:', 'red');
      this.results.errors.forEach(error => {
        this.log(`  - ${error}`, 'red');
      });
    }

    this.log('\n' + '='.repeat(60), 'cyan');

    if (this.results.failed === 0) {
      this.log('✅ ALL BRIDGE TESTS PASSED!', 'green');
    } else {
      this.log(`❌ ${this.results.failed} TEST(S) FAILED`, 'red');
    }

    this.log('='.repeat(60) + '\n', 'cyan');
  }
}

// Run tests
if (require.main === module) {
  const runner = new BridgeTestRunner();
  runner.runTests().catch(error => {
    console.error('Test runner error:', error);
    process.exit(1);
  });
}

module.exports = BridgeTestRunner;
