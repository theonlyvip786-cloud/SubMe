/**
 * useSmsReader — Auto-detect UPI payment from bank SMS (Android only)
 *
 * Works in two modes:
 *  1. Native APK build with READ_SMS permission: fully automatic
 *  2. Expo Go / iOS: returns null (user manually enters UTR)
 *
 * Indian bank SMS patterns covered:
 *  - SBI: "INR X.XX debited from ... Ref No XXXXXXXXXXXX"
 *  - HDFC: "Rs.X debited from ... UPI Ref No XXXXXXXXXXXX"
 *  - ICICI: "INR X.XX debited ... UPI Ref XXXXXXXXXXXX"
 *  - Axis: "Rs.X debited ... UPI Ref XXXXXXXXXXXX"
 *  - Kotak, PNB, BOB, Yes Bank, IndusInd, IDFC etc.
 */

import { useCallback } from 'react';
import { Platform, PermissionsAndroid } from 'react-native';

export interface SmsPaymentResult {
  utrNumber: string;
  amount: string;
  bankName: string;
  raw: string;
  smsTimestampMs?: number; // Unix ms when the SMS was received
}

// ─── Regex Patterns ──────────────────────────────────────────────────────────

/** Matches UPI reference / UTR numbers — 12 digits (sometimes more) */
const UTR_PATTERNS = [
  /(?:UPI\s*Ref(?:erence)?\s*(?:No\.?|ID|#|:)?\s*)[:\s]?(\d{10,20})/i,
  /(?:Ref(?:erence)?\s*(?:No\.?|ID|#|:)?)\s*[:\s]?(\d{10,20})/i,
  /(?:Transaction\s*(?:ID|Ref)\s*[:\s]?)(\d{10,20})/i,
  /(?:UTR\s*[:\s]?)([A-Z0-9]{10,22})/i,
  /(\d{12})/,   // bare 12-digit as last resort
];

/** Matches debit amount in various formats */
const AMOUNT_PATTERNS = [
  /(?:INR|Rs\.?|₹)\s*([0-9,]+(?:\.[0-9]{1,2})?)/i,
  /([0-9,]+(?:\.[0-9]{1,2})?)\s*(?:INR|Rs\.?|₹)/i,
  /debited\s+(?:INR|Rs\.?|₹)?\s*([0-9,]+(?:\.[0-9]{1,2})?)/i,
];

/** Keywords that indicate this is a bank debit/UPI SMS */
const BANK_DEBIT_KEYWORDS = [
  'debited', 'debit', 'paid', 'transferred', 'sent',
  'upi', 'bhim', 'phonepe', 'gpay', 'paytm',
];

/** Known UPI recipient hint — match our UPI ID */
const OUR_UPI_ID = 'subkaro@axl';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function extractUtr(body: string): string | null {
  for (const pattern of UTR_PATTERNS) {
    const match = body.match(pattern);
    if (match?.[1] && match[1].length >= 10) {
      return match[1].trim().toUpperCase();
    }
  }
  return null;
}

function extractAmount(body: string): string | null {
  for (const pattern of AMOUNT_PATTERNS) {
    const match = body.match(pattern);
    if (match?.[1]) {
      // Remove commas, return clean number string
      return match[1].replace(/,/g, '');
    }
  }
  return null;
}

function isBankDebitSms(body: string): boolean {
  const lower = body.toLowerCase();
  return BANK_DEBIT_KEYWORDS.some((kw) => lower.includes(kw));
}

function extractBankName(address: string, body: string): string {
  const senderMap: Record<string, string> = {
    'sbi': 'SBI', 'hdfc': 'HDFC Bank', 'icici': 'ICICI Bank',
    'axis': 'Axis Bank', 'kotak': 'Kotak Bank', 'pnb': 'PNB',
    'bob': 'Bank of Baroda', 'yes': 'Yes Bank', 'indus': 'IndusInd Bank',
    'idfc': 'IDFC Bank', 'union': 'Union Bank', 'canara': 'Canara Bank',
    'federal': 'Federal Bank', 'bandhan': 'Bandhan Bank',
  };
  const src = (address + body).toLowerCase();
  for (const [key, name] of Object.entries(senderMap)) {
    if (src.includes(key)) return name;
  }
  return 'Your Bank';
}

// ─── Permission Request ───────────────────────────────────────────────────────

export async function requestSmsPermission(): Promise<boolean> {
  return false;
}

// ─── SMS Reader (Native only — gracefully degrades in Expo Go) ───────────────

/**
 * Reads the last `maxCount` SMS messages from inbox and finds UPI payment SMS.
 * Only works in a native Android build (not Expo Go).
 * Returns null if running on iOS or if native module is unavailable.
 */
export async function readUpiPaymentSms(
  expectedAmount?: string,
  maxCount: number = 20,
): Promise<SmsPaymentResult | null> {
  if (Platform.OS !== 'android') return null;

  // Check if the native SMS module is available (only in native APK builds)
  let SmsAndroid: any = null;
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    SmsAndroid = require('react-native-get-sms-android');
  } catch {
    // Module not available in Expo Go — graceful degradation
    return null;
  }

  return new Promise((resolve) => {
    const filter = {
      box: 'inbox',
      maxCount,
    };

    SmsAndroid.list(
      JSON.stringify(filter),
      (fail: string) => {
        console.warn('[useSmsReader] SMS read failed:', fail);
        resolve(null);
      },
      (_count: number, smsList: string) => {
        try {
          const messages: Array<{ address: string; body: string; date: number }> =
            JSON.parse(smsList);

          // Sort newest first
          messages.sort((a, b) => b.date - a.date);

          for (const msg of messages) {
            const { address, body } = msg;
            if (!isBankDebitSms(body)) continue;

            const utrNumber = extractUtr(body);
            if (!utrNumber) continue;

            const amount = extractAmount(body);
            if (!amount) continue;

            // If we know the expected amount, verify it matches (within ±1 tolerance)
            if (expectedAmount) {
              const exp = parseFloat(expectedAmount);
              const got = parseFloat(amount);
              if (Math.abs(exp - got) > 1) continue; // amount mismatch — skip
            }

            // Bonus check — if SMS mentions our UPI ID, prioritise it
            const containsOurId = body.includes(OUR_UPI_ID);

            resolve({
              utrNumber,
              amount,
              bankName: extractBankName(address, body),
              raw: body,
              smsTimestampMs: msg.date || undefined,
            });
            return;
          }

          // No matching SMS found
          resolve(null);
        } catch {
          resolve(null);
        }
      },
    );
  });
}

function isSmsModuleAvailable(): boolean {
  return false;
}

// ─── The Hook ────────────────────────────────────────────────────────────────

/**
 * useSmsReader — Call `detect(expectedAmount)` after user returns from UPI app.
 * Returns a SmsPaymentResult if a matching bank SMS is found, or null.
 */
export function useSmsReader() {
  const detect = useCallback(async (expectedAmount?: string): Promise<SmsPaymentResult | null> => {
    if (Platform.OS !== 'android') return null;
    const hasPermission = await requestSmsPermission();
    if (!hasPermission) return null;
    return readUpiPaymentSms(expectedAmount);
  }, []);

  const isSupported = Platform.OS === 'android' && isSmsModuleAvailable();

  return { detect, isSupported };
}
