import { createInputEvent, createTextInputEvent } from '../../src/input/inputCapture';

describe('Input Capture Layer', () => {
  it('creates a valid InputEvent for manual text input', () => {
    const raw = 'I spent ₹250 on lunch today.';
    const event = createTextInputEvent(raw);

    expect(event.requestId).toMatch(/^req_text_/);
    expect(event.sourceType).toBe('text');
    expect(event.rawText).toBe(raw);
    expect(event.sourceApp).toBeNull();
    expect(new Date(event.timestamp).toString()).not.toBe('Invalid Date');
  });

  it('preserves exact rawText without silent rewriting', () => {
    const trickyText = '  Pay ₹ 1,200 for  Wi-Fi!!  ';
    const event = createTextInputEvent(trickyText);
    expect(event.rawText).toBe(trickyText);
  });

  it('createInputEvent supports custom parameters and source types', () => {
    const event = createInputEvent({
      rawText: 'Bank SMS: INR 500 debited',
      sourceType: 'notification',
      sourceApp: 'com.bank.app',
      requestId: 'custom_req_99',
    });

    expect(event.requestId).toBe('custom_req_99');
    expect(event.sourceType).toBe('notification');
    expect(event.sourceApp).toBe('com.bank.app');
  });
});

