import {
  classifyNotification,
  extractAmount,
  generatePlainSummary,
} from '../../src/notifications/triageClassifier';

describe('triageClassifier', () => {
  describe('extractAmount', () => {
    it('extracts INR rupee amounts with symbols or prefixes', () => {
      expect(extractAmount('Paid Rs 450.00 to merchant')).toBe('₹450.00');
      expect(extractAmount('Debited by ₹1,200 on 15-Nov')).toBe('₹1,200');
      expect(extractAmount('INR 850 paid to Swiggy')).toBe('₹850');
      expect(extractAmount('$25.50 charged')).toBe('$25.50');
    });

    it('returns undefined when no currency amount is present', () => {
      expect(extractAmount('Meeting starting in 10 minutes')).toBeUndefined();
    });
  });

  describe('generatePlainSummary', () => {
    it('generates a clean one-line summary for debit alerts', () => {
      const summary = generatePlainSummary(
        'HDFC Bank',
        'A/c *1234 debited by Rs 450.00 at Starbucks on 14-Nov-26. Avl Bal Rs 5,230.'
      );
      expect(summary).toContain('Debit of ₹450.00');
      expect(summary).toContain('Starbucks');
    });

    it('generates a clean one-line summary for credit alerts', () => {
      const summary = generatePlainSummary(
        'ICICI Bank',
        'Salary credited to your account: ₹75,000 received from Acme Corp on 01-Nov.'
      );
      expect(summary).toContain('Credit of ₹75,000');
    });

    it('generates bill due summary', () => {
      const summary = generatePlainSummary(
        'Airtel',
        'Your postpaid bill is due on 20-Nov. Total amount due: ₹799.'
      );
      expect(summary).toBe('Bill due: ₹799');
    });
  });

  describe('classifyNotification', () => {
    it('1. classifies bank debit alert as Useful ("Spending alert")', () => {
      const result = classifyNotification({
        title: 'HDFC Bank Alert',
        text: 'A/c *1234 debited by Rs 450.00 on 14-Nov-26 by UPI. Avl Bal Rs 5,230.',
      });
      expect(result.category).toBe('useful');
      expect(result.reason).toBe('Spending alert');
      expect(result.extractedAmount).toBe('₹450.00');
      expect(result.plainSummary).toBeDefined();
    });

    it('2. classifies credit card cashback promo as Other ("Promotional wording")', () => {
      const result = classifyNotification({
        title: 'Credit Card Rewards',
        text: 'Congratulations! You won Rs 50 cashback on your last order. Claim your offer now!',
      });
      expect(result.category).toBe('other');
      expect(result.reason).toBe('Promotional wording');
    });

    it('3. classifies "Pay Now or Miss ₹50" marketing hook as Other ("Promotional wording")', () => {
      const result = classifyNotification({
        title: 'Special Deal',
        text: 'Pay Now or Miss ₹50! Recharging your plan gives flat discounts today only.',
      });
      expect(result.category).toBe('other');
      expect(result.reason).toBe('Promotional wording');
    });

    it('4. classifies health insurance promo as Other ("Promotional wording")', () => {
      const result = classifyNotification({
        title: 'Protect Your Family',
        text: 'Get ₹1 Crore Health Insurance at just ₹490/month! Limited time upgrade offer.',
      });
      expect(result.category).toBe('other');
      expect(result.reason).toBe('Promotional wording');
    });

    it('5. classifies empty or "Image" placeholders as Other ("No actionable text")', () => {
      expect(
        classifyNotification({ title: 'WhatsApp', text: 'Image' }).category
      ).toBe('other');
      expect(
        classifyNotification({ title: 'WhatsApp', text: 'Image' }).reason
      ).toBe('No actionable text');

      expect(
        classifyNotification({ title: 'Telegram', text: 'photo' }).category
      ).toBe('other');

      expect(
        classifyNotification({ title: '', text: '' }).category
      ).toBe('other');
      expect(
        classifyNotification({ title: '', text: '' }).reason
      ).toBe('No actionable text');
    });

    it('6. classifies calendar and meeting invitations as Useful ("Meeting invitation")', () => {
      const result = classifyNotification({
        title: 'Team Sprint Planning',
        text: 'You have been invited to a meeting on Monday at 10 AM on Google Meet.',
      });
      expect(result.category).toBe('useful');
      expect(result.reason).toBe('Meeting invitation');
    });

    it('7. classifies bill due reminders as Useful ("Bill payment due" or "Reminder / deadline")', () => {
      const result = classifyNotification({
        title: 'Electricity Board',
        text: 'Reminder: Electricity bill due tomorrow. Amount ₹1,420.',
      });
      expect(result.category).toBe('useful');
      expect(['Bill payment due', 'Reminder / deadline']).toContain(result.reason);
      expect(result.extractedAmount).toBe('₹1,420');
    });

    it('8. classifies phony instruction messages designed to look like instructions as Other ("Promotional wording")', () => {
      const result = classifyNotification({
        title: 'Action Required',
        text: 'Click here to claim your free reward points before they expire! Don\'t miss out.',
      });
      expect(result.category).toBe('other');
      expect(result.reason).toBe('Promotional wording');
    });

    it('9. applies bias rule: when unsure, classifies ambiguous notice as Useful ("Important notice")', () => {
      const result = classifyNotification({
        title: 'BlueDart Courier',
        text: 'Your package with tracking #789012 has arrived at the local distribution hub.',
      });
      expect(result.category).toBe('useful');
      expect(result.reason).toBe('Important notice');
    });

    it('10. respects user override to Useful', () => {
      const result = classifyNotification({
        title: 'Promotional Newsletter',
        text: 'Claim flat 50% discount and cashback today!',
        execution_result: { triage_override: 'useful' },
      });
      expect(result.category).toBe('useful');
      expect(result.reason).toBe('Marked useful by you');
      expect(result.isUserOverride).toBe(true);
    });

    it('11. respects user override to Other', () => {
      const result = classifyNotification({
        title: 'Bank Alert',
        text: 'A/c *1234 debited by Rs 450.00 on 14-Nov-26.',
        execution_result: { triage_override: 'other' },
      });
      expect(result.category).toBe('other');
      expect(result.reason).toBe('Marked other by you');
      expect(result.isUserOverride).toBe(true);
    });

    it('12. preserves Useful classification when an action plan or intent analysis exists', () => {
      const result = classifyNotification({
        title: 'Random Note',
        text: 'Buy groceries tonight',
        action_plan: { actions: [{ type: 'create_reminder' }] },
      });
      expect(result.category).toBe('useful');
      expect(result.reason).toBe('Actionable request');
    });
  });
});
