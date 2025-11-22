#!/usr/bin/env node

/**
 * Security Setup Helper
 * Generates secure random secrets for production deployment
 */

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

console.log('='.repeat(80));
console.log('JinieBotInterface - Security Setup Helper');
console.log('='.repeat(80));
console.log();

/**
 * Generate a secure random string
 */
function generateSecret(bytes = 64) {
  return crypto.randomBytes(bytes).toString('hex');
}

/**
 * Validate existing .env file
 */
function validateEnvFile() {
  const envPath = path.join(__dirname, '.env');
  
  if (!fs.existsSync(envPath)) {
    console.log('⚠️  No .env file found. Creating from template...');
    return false;
  }

  const envContent = fs.readFileSync(envPath, 'utf8');
  const issues = [];

  // Check for weak secrets
  if (envContent.includes('CHANGE_ME') || envContent.includes('XXX')) {
    issues.push('❌ Default secrets detected - must be changed');
  }

  // Check for localhost in production URLs
  if (envContent.includes('NODE_ENV=production') && envContent.includes('localhost')) {
    issues.push('⚠️  Localhost URLs detected in production environment');
  }

  // Check session secret length
  const sessionSecretMatch = envContent.match(/SESSION_SECRET=(.+)/);
  if (sessionSecretMatch && sessionSecretMatch[1].length < 32) {
    issues.push('❌ SESSION_SECRET is too short (minimum 32 characters)');
  }

  if (issues.length > 0) {
    console.log('Security Issues Found:');
    issues.forEach(issue => console.log(`  ${issue}`));
    return false;
  }

  console.log('✅ .env file validation passed');
  return true;
}

/**
 * Generate new secrets
 */
function generateSecrets() {
  console.log('Generating Secure Random Secrets...');
  console.log('-'.repeat(80));
  console.log();

  const sessionSecret = generateSecret(64);
  const sessionCryptoSecret = generateSecret(64);

  console.log('SESSION_SECRET:');
  console.log(sessionSecret);
  console.log();

  console.log('SESSION_CRYPTO_SECRET:');
  console.log(sessionCryptoSecret);
  console.log();

  console.log('-'.repeat(80));
  console.log('⚠️  IMPORTANT: Store these secrets securely!');
  console.log('   - Add them to your .env file');
  console.log('   - Never commit them to version control');
  console.log('   - Use different secrets for each environment');
  console.log('   - Rotate them every 90 days');
  console.log();

  // Offer to create .env file
  const readline = require('readline').createInterface({
    input: process.stdin,
    output: process.stdout
  });

  readline.question('Would you like to update/create .env file with these secrets? (y/n): ', (answer) => {
    if (answer.toLowerCase() === 'y') {
      updateEnvFile(sessionSecret, sessionCryptoSecret);
    } else {
      console.log('\nSecrets generated but not saved. Copy them manually to your .env file.');
    }
    readline.close();
  });
}

/**
 * Update .env file with new secrets
 */
function updateEnvFile(sessionSecret, sessionCryptoSecret) {
  const envPath = path.join(__dirname, '.env');
  const templatePath = path.join(__dirname, 'template ENV');

  let envContent;

  if (fs.existsSync(envPath)) {
    envContent = fs.readFileSync(envPath, 'utf8');
  } else if (fs.existsSync(templatePath)) {
    envContent = fs.readFileSync(templatePath, 'utf8');
  } else {
    console.error('❌ No .env or template file found!');
    return;
  }

  // Update secrets
  envContent = envContent.replace(
    /SESSION_SECRET=.*/,
    `SESSION_SECRET=${sessionSecret}`
  );
  envContent = envContent.replace(
    /SESSION_CRYPTO_SECRET=.*/,
    `SESSION_CRYPTO_SECRET=${sessionCryptoSecret}`
  );

  // Write back
  fs.writeFileSync(envPath, envContent);
  console.log('\n✅ .env file updated with new secrets');
  console.log('⚠️  Remember to update other environment-specific values manually');
}

/**
 * Display security checklist
 */
function showSecurityChecklist() {
  console.log();
  console.log('='.repeat(80));
  console.log('PRODUCTION DEPLOYMENT SECURITY CHECKLIST');
  console.log('='.repeat(80));
  console.log();
  console.log('Pre-Deployment:');
  console.log('  [ ] All environment variables configured');
  console.log('  [ ] Secure secrets generated (64+ characters)');
  console.log('  [ ] Discord OAuth callback URL updated');
  console.log('  [ ] SSL/TLS certificates installed');
  console.log('  [ ] Database secured (IP whitelist, strong password)');
  console.log('  [ ] Firewall configured (ports 80, 443 only)');
  console.log('  [ ] NODE_ENV set to "production"');
  console.log('  [ ] ALLOWED_ORIGINS configured');
  console.log();
  console.log('Security Features:');
  console.log('  [ ] Helmet middleware enabled');
  console.log('  [ ] Rate limiting configured');
  console.log('  [ ] CORS whitelist active');
  console.log('  [ ] Session cookies secure/httpOnly');
  console.log('  [ ] Input validation on all routes');
  console.log('  [ ] MongoDB sanitization active');
  console.log();
  console.log('Monitoring:');
  console.log('  [ ] Error logging configured');
  console.log('  [ ] Security event monitoring');
  console.log('  [ ] Failed login tracking');
  console.log('  [ ] SSL certificate expiration alerts');
  console.log();
  console.log('For complete security documentation, see SECURITY.md');
  console.log('='.repeat(80));
  console.log();
}

/**
 * Main menu
 */
function main() {
  const args = process.argv.slice(2);

  if (args.includes('--generate') || args.includes('-g')) {
    generateSecrets();
  } else if (args.includes('--validate') || args.includes('-v')) {
    validateEnvFile();
  } else if (args.includes('--checklist') || args.includes('-c')) {
    showSecurityChecklist();
  } else {
    console.log('Usage:');
    console.log('  node generate-secrets.js --generate    (-g)  Generate new secure secrets');
    console.log('  node generate-secrets.js --validate    (-v)  Validate existing .env file');
    console.log('  node generate-secrets.js --checklist   (-c)  Show security checklist');
    console.log();
    console.log('Quick start: node generate-secrets.js --generate');
    console.log();
  }
}

// Run if called directly
if (require.main === module) {
  main();
}

module.exports = { generateSecret, validateEnvFile };
