import {
  createInputEvent,
  createNotificationInputEvent,
  createTextInputEvent,
  createVoiceInputEvent,
} from '../../src/input/inputCapture';

describe('Input Capture Layer', () => {
  it('creates a valid InputEvent for manual text input', () => {
    const raw = 'I spent ₹250 on lunch today.';
    const event = createTextInputEvent(raw);

    expect(event.requestId).toMatch(/^req_text_/);
    expect(event.sourceType).toBe('text');
    expect(event.source).toBe('text');
    expect(event.rawText).toBe(raw);
    expect(event.raw_input).toBe(raw);
    expect(event.sourceApp).toBeNull();
    expect(event.source_app).toBeNull();
    expect(new Date(event.timestamp).toString()).not.toBe('Invalid Date');
  });

  it('preserves exact rawText without silent rewriting', () => {
    const trickyText = '  Pay ₹ 1,200 for  Wi-Fi!!  ';
    const event = createTextInputEvent(trickyText);
    expect(event.rawText).toBe(trickyText);
    expect(event.raw_input).toBe(trickyText);
  });

  it('createVoiceInputEvent creates an InputEvent with voice source and metadata', () => {
    const transcript = 'Remind me to call Mom at 5 PM';
    const event = createVoiceInputEvent({
      rawTranscript: transcript,
      language: 'en-IN',
      confidence: 0.94,
    });

    expect(event.requestId).toMatch(/^req_voice_/);
    expect(event.sourceType).toBe('voice');
    expect(event.source).toBe('voice');
    expect(event.rawText).toBe(transcript);
    expect(event.raw_input).toBe(transcript);
    expect(event.metadata?.language).toBe('en-IN');
    expect(event.metadata?.recognition_confidence).toBe(0.94);
    expect(event.sourceApp).toBeNull();
  });

  it('createNotificationInputEvent creates an InputEvent with notification source and package name', () => {
    const notifText = 'Axis Bank: INR 1,500 debited at Supermarket';
    const event = createNotificationInputEvent({
      rawText: notifText,
      sourceApp: 'com.axis.mobile',
      notificationId: 'notif_123',
    });

    expect(event.requestId).toMatch(/^req_notif_/);
    expect(event.sourceType).toBe('notification');
    expect(event.source).toBe('notification');
    expect(event.rawText).toBe(notifText);
    expect(event.sourceApp).toBe('com.axis.mobile');
    expect(event.source_app).toBe('com.axis.mobile');
    expect(event.metadata?.notificationId).toBe('notif_123');
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
    expect(event.source).toBe('notification');
    expect(event.sourceApp).toBe('com.bank.app');
  });
});
