import dotenv from 'dotenv';

dotenv.config();

/**
 * Simulates sending an SMS. 
 * In a real-world scenario, this would integrate with Twilio, Vonage, or similar.
 */
export const sendSMS = async (to: string, message: string) => {
  const isProd = process.env.NODE_ENV === 'production';
  
  // Simulate network delay
  await new Promise(resolve => setTimeout(resolve, 800));

  console.log('--- SMS DISPATCHED ---');
  console.log(`To: ${to}`);
  console.log(`Message: ${message}`);
  console.log(`Timestamp: ${new Date().toISOString()}`);
  console.log('----------------------');

  // If we had an API key, we would use it here
  const twilioSid = process.env.TWILIO_ACCOUNT_SID;
  if (twilioSid) {
    // Real implementation would go here
  }

  return { success: true, messageId: `sms_${Math.random().toString(36).substr(2, 9)}` };
};
