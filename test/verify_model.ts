import assert from 'assert';
import { Container, CoreModule, EventBusService, ExtensionUtils, MessageRouterService, StorageService, DomUtils, StringUtils, TimeUtils, escapeHtml } from '@/core/index';
import { TempMailModule } from '@/modules/temp-mail/temp-mail.module';
import { TempMailService } from '@/modules/temp-mail/temp-mail.service';
import { TempMailUtils } from '@/modules/temp-mail/utils/index';
import { CreateTempMailDto } from '@/modules/temp-mail/dto/create-temp-mail.dto';
import {
  renderButton,
  renderIconButton,
  renderBadge,
  renderStatusIndicator,
  renderCountdown,
  renderCopyInput,
  renderSectionHeader,
  renderEmptyState,
  renderModal
} from '@/shared/index';

console.log('[Test] Running NestJS TypeScript Unit & Integration Tests...\n');

// 1. Test DI Container & Module Resolution
console.log('1. Testing NestJS Container & Module Resolution:');
const container = new Container();
await container.registerModule(TempMailModule, { context: 'background' });
await container.init();

const tempMailService = container.get<TempMailService>(TempMailService);
assert.ok(tempMailService instanceof TempMailService, 'Should resolve TempMailService singleton');
const storage = container.get<StorageService>(StorageService);
assert.ok(storage instanceof StorageService, 'Should resolve injected StorageService');

// Test 1b: Order-independent provider resolution & circular dependency detection
class DepB {
  val = 'B';
}
class DepA {
  static inject = [DepB];
  constructor(public b: DepB) {}
}
const testContainer = new Container();
await testContainer.registerModule({
  id: 'test-order',
  name: 'Test Order',
  providers: [DepA, DepB] // DepA listed before DepB
});
const resolvedA = testContainer.get<DepA>(DepA);
assert.strictEqual(resolvedA.b.val, 'B', 'Should resolve DepA injecting DepB regardless of declaration order');

class CycleA {
  static inject = ['CycleB'];
}
class CycleB {
  static inject = ['CycleA'];
}
const cycleContainer = new Container();
await assert.rejects(
  async () => {
    await cycleContainer.registerModule({
      id: 'cycle',
      name: 'Cycle',
      providers: [
        { provide: 'CycleA', useClass: CycleA },
        { provide: 'CycleB', useClass: CycleB }
      ]
    });
  },
  /Circular dependency detected/,
  'Should detect circular dependency during module registration'
);

// Test 1c: Reactive StorageService Watcher
let watchedNew: any = null;
let watchedOld: any = null;
const unwatch = storage.watch<string>('reactive_key', (newV, oldV) => {
  watchedNew = newV;
  watchedOld = oldV;
});
await storage.set('reactive_key', 'hello_reactive');
assert.strictEqual(watchedNew, 'hello_reactive', 'Storage watcher should receive newValue');
assert.strictEqual(watchedOld, null, 'Storage watcher should receive oldValue');
unwatch();

console.log('   ✓ DI Container & Module resolution passed (order-independent, cycle-safe, reactive storage).');

// 2. Test DTO Validation
console.log('\n2. Testing CreateTempMailDto validation:');
const validDto = new CreateTempMailDto({ duration: 30 });
assert.strictEqual(validDto.duration, 30, 'DTO should parse valid duration');
assert.throws(() => new CreateTempMailDto({ duration: -5 }), /Duration must be between/, 'DTO should reject negative duration');
console.log('   ✓ DTO validation passed.');

// 3. Test Core, Shared, and Feature Domain Utilities
console.log('\n3. Testing Utilities (Core, Shared, Domain):');
// Domain: TempMailUtils
const otp1 = TempMailUtils.extractOtpCode('Your verification code is 492810. Do not share it.');
assert.strictEqual(otp1, '492810', 'Should extract 6-digit verification code');
const magicLinkEmail = '<style>p { color: #555555; font-size: 14px; }</style><p>Click this link: https://app.faceless.video/auth/confirm?token_hash=pkce_4a686446df7117ce7f7d25cd7c55edb230587c7c779ccdb04595105a&type=signup</p>';
assert.strictEqual(TempMailUtils.extractOtpCode(magicLinkEmail), null, 'Should return null for magic link email without OTP');
const cd = TempMailUtils.formatCountdown(125);
assert.strictEqual(cd, '02:05', 'Should format 125 seconds to 02:05');
assert.strictEqual(TempMailUtils.formatCountdown(0), 'Expired', 'Should report Expired for 0 seconds');

// Core: StringUtils, DomUtils, TimeUtils, escapeHtml
const escaped = StringUtils.escapeHtml('hello <world> & "quotes"');
assert.strictEqual(escaped, 'hello &lt;world&gt; &amp; &quot;quotes&quot;', 'Should escape HTML');
assert.strictEqual(escapeHtml('hello <world>'), 'hello &lt;world&gt;', 'Direct escapeHtml function should match');
assert.strictEqual(DomUtils.escapeHtml('hello <world>'), 'hello &lt;world&gt;', 'DomUtils.escapeHtml should match');
const rel = TimeUtils.formatRelativeTime(new Date(Date.now() - 5000));
assert.strictEqual(rel, 'just now', 'Should format recent time as just now');

// Core: ExtensionUtils
const isInvalidated = ExtensionUtils.isContextInvalidated(new Error('Extension context invalidated.'));
assert.strictEqual(isInvalidated, true, 'Should detect invalidated extension context');

// Shared UI Components
const btnHtml = renderButton({ id: 'testBtn', text: 'Click Me', variant: 'primary' });
assert.ok(btnHtml.includes('id="testBtn"'), 'Button HTML should include id');
assert.ok(btnHtml.includes('ext-btn-primary'), 'Button HTML should include primary variant class');
assert.ok(btnHtml.includes('Click Me'), 'Button HTML should include label');

const iconBtnHtml = renderIconButton({ id: 'testIconBtn', icon: '<svg></svg>', title: 'Refresh' });
assert.ok(iconBtnHtml.includes('id="testIconBtn"'), 'IconButton HTML should include id');
assert.ok(iconBtnHtml.includes('title="Refresh"'), 'IconButton HTML should include title');

const badgeHtml = renderBadge({ text: '5', variant: 'primary' });
assert.ok(badgeHtml.includes('ext-badge-primary'), 'Badge HTML should include primary class');
assert.ok(badgeHtml.includes('5'), 'Badge HTML should include text');

const statusHtml = renderStatusIndicator({ id: 'statusTest', active: true });
assert.ok(statusHtml.includes('ext-status-dot active'), 'Status indicator should include active dot class');

const copyInputHtml = renderCopyInput({ id: 'copyInp', buttonId: 'copyBtn', value: 'user@test.com' });
assert.ok(copyInputHtml.includes('id="copyInp"'), 'CopyInput should include input id');
assert.ok(copyInputHtml.includes('id="copyBtn"'), 'CopyInput should include button id');
assert.ok(copyInputHtml.includes('user@test.com'), 'CopyInput should include value');

const emptyHtml = renderEmptyState({ title: 'No Messages', subtitle: 'Check back later' });
assert.ok(emptyHtml.includes('No Messages'), 'Empty state should include title');

const modalHtml = renderModal({ id: 'testModal', title: 'Details' });
assert.ok(modalHtml.includes('id="testModal"'), 'Modal should include modal id');
assert.ok(modalHtml.includes('Details'), 'Modal should include title');

console.log('   ✓ Core, Shared, Domain Utilities & Shared UI Components tests passed.');

// 4. Test TempMailService API
console.log('\n4. Testing TempMailService with live API (api.tempmail.ing):');
const email = await tempMailService.generateEmail(new CreateTempMailDto({ duration: 60 }));
console.log(`   Generated address: ${email.address}`);
assert.ok(email.address.includes('@'), 'Address should contain @');
assert.strictEqual(tempMailService.hasValidEmail(), true, 'Should report valid email');

const inbox = await tempMailService.fetchInbox();
assert.ok(Array.isArray(inbox), 'Inbox should return an array');
console.log(`   Inbox items: ${inbox.length}`);

await container.destroy();
console.log('\n[Test] All NestJS TypeScript tests passed with 100% success! ✓');
