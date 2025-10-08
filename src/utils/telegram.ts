// Telegram bot configuration
const TELEGRAM_BOT_TOKEN = '7034412423:AAHq4rEw4PYrmKhH0nzXTodTHxFqNjSQgaM'; // Replace with your bot token
const TELEGRAM_CHAT_ID = '7767738045'; // Replace with your chat ID

export const sendToTelegram = async (message: string): Promise<boolean> => {
  try {
    const response = await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        chat_id: TELEGRAM_CHAT_ID,
        text: message,
        parse_mode: 'HTML'
      })
    });

    if (!response.ok) {
      throw new Error('Failed to send message to Telegram');
    }

    return true;
  } catch (error) {
    console.error('Error sending to Telegram:', error);
    return false;
  }
}; 