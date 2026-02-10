// Preset ISO 8583 Message Examples
// Each is a programmatically constructed hex string that parses cleanly

export interface PresetMessage {
    id: string;
    name: string;
    mti: string;
    scenario: string;
    description: string;
    hex: string;
    highlights: string[];
}

// ─── Bitmap Builder ───────────────────────────────────────────────
// Takes an array of field numbers and returns the correct 16-char hex bitmap
function buildBitmap(fields: number[]): string {
    const bits = new Uint8Array(64); // 64 bits = 8 bytes
    for (const f of fields) {
        if (f >= 1 && f <= 64) {
            bits[f - 1] = 1;
        }
    }
    let hex = '';
    for (let i = 0; i < 8; i++) {
        let byte = 0;
        for (let b = 0; b < 8; b++) {
            byte = (byte << 1) | bits[i * 8 + b];
        }
        hex += byte.toString(16).padStart(2, '0').toUpperCase();
    }
    return hex;
}

// Build primary + secondary bitmaps when fields > 64 exist
function buildDualBitmap(fields: number[]): string {
    const primaryFields = fields.filter(f => f <= 64);
    const secondaryFields = fields.filter(f => f > 64);

    // If secondary fields exist, set bit 1 (secondary bitmap present)
    if (secondaryFields.length > 0 && !primaryFields.includes(1)) {
        primaryFields.push(1);
    }

    const primary = buildBitmap(primaryFields);

    if (secondaryFields.length === 0) return primary;

    // Secondary bitmap: field 65 → bit 1, field 70 → bit 6, etc.
    const secBits = new Uint8Array(64);
    for (const f of secondaryFields) {
        secBits[f - 65] = 1;
    }
    let secHex = '';
    for (let i = 0; i < 8; i++) {
        let byte = 0;
        for (let b = 0; b < 8; b++) {
            byte = (byte << 1) | secBits[i * 8 + b];
        }
        secHex += byte.toString(16).padStart(2, '0').toUpperCase();
    }
    return primary + secHex;
}

// ─── ASCII / Hex Helpers ──────────────────────────────────────────
function asciiToHex(str: string): string {
    return str.split('').map(c => c.charCodeAt(0).toString(16).padStart(2, '0')).join('').toUpperCase();
}

// Pad numeric (BCD) to even length
function numHex(val: string, maxLen: number): string {
    const padded = val.padStart(maxLen, '0');
    // If odd maxLen, parser reads maxLen+1 hex chars (BCD padding)
    if (maxLen % 2 !== 0) {
        return '0' + padded; // leading zero pad to make even
    }
    return padded;
}

// ─── Preset Builders ──────────────────────────────────────────────

function buildAuthRequest(): string {
    const mti = '0100';
    const fields = [2, 3, 4, 7, 11, 12, 13, 14, 22, 25, 41, 42, 43, 49];
    const bitmap = buildBitmap(fields);

    const de2 = '16' + '4111111111111111';   // LLVAR: len=16, 16-digit PAN
    const de3 = '000000';                     // Processing code: Purchase
    const de4 = '000000000500';               // Amount: $5.00 (500 cents, 12 digits)
    const de7 = '0210120000';                 // Transmission: MMDDhhmmss (10 digits)
    const de11 = '123456';                    // STAN (6 digits)
    const de12 = '120000';                    // Local time: hhmmss (6 digits)
    const de13 = '0210';                      // Local date: MMDD (4 digits)
    const de14 = '2612';                      // Expiry: YYMM (4 digits)
    const de22 = numHex('051', 3);            // POS Entry: Chip (3 digits → 4 hex)
    const de25 = '00';                        // POS Condition: Normal (2 digits)
    const de41 = asciiToHex('TERM0001');       // Terminal ID (8 chars ANS → 16 hex)
    const de42 = asciiToHex('000000000012345'); // Merchant ID (15 chars ANS → 30 hex)
    const de43 = asciiToHex('STARBUCKS DOWNTOWN      SAN FRANCISCO US'); // 40 chars
    const de49 = numHex('840', 3);            // Currency: USD (3 digits → 4 hex)

    return mti + bitmap + de2 + de3 + de4 + de7 + de11 + de12 + de13 + de14 + de22 + de25 + de41 + de42 + de43 + de49;
}

function buildAuthResponseApproved(): string {
    const mti = '0110';
    const fields = [2, 3, 4, 7, 11, 12, 13, 37, 38, 39, 41, 49];
    const bitmap = buildBitmap(fields);

    const de2 = '16' + '4111111111111111';
    const de3 = '000000';
    const de4 = '000000000500';
    const de7 = '0210120001';
    const de11 = '123456';
    const de12 = '120001';
    const de13 = '0210';
    const de37 = asciiToHex('000000123456');   // RRN (12 chars AN → 24 hex)
    const de38 = asciiToHex('AB1234');          // Auth Code (6 chars AN → 12 hex)
    const de39 = asciiToHex('00');              // Response: Approved (2 chars AN → 4 hex)
    const de41 = asciiToHex('TERM0001');
    const de49 = numHex('840', 3);

    return mti + bitmap + de2 + de3 + de4 + de7 + de11 + de12 + de13 + de37 + de38 + de39 + de41 + de49;
}

function buildAuthResponseDeclined(): string {
    const mti = '0110';
    const fields = [2, 3, 4, 7, 11, 12, 13, 37, 38, 39, 41, 49];
    const bitmap = buildBitmap(fields);

    const de2 = '16' + '4111111111111111';
    const de3 = '000000';
    const de4 = '000000000500';
    const de7 = '0210120001';
    const de11 = '123456';
    const de12 = '120001';
    const de13 = '0210';
    const de37 = asciiToHex('000000123456');
    const de38 = asciiToHex('      ');          // No auth code on decline (6 spaces)
    const de39 = asciiToHex('51');              // Response: Insufficient Funds
    const de41 = asciiToHex('TERM0001');
    const de49 = numHex('840', 3);

    return mti + bitmap + de2 + de3 + de4 + de7 + de11 + de12 + de13 + de37 + de38 + de39 + de41 + de49;
}

function buildReversal(): string {
    const mti = '0420';
    const fields = [2, 3, 4, 7, 11, 12, 13, 37, 39, 41, 49];
    const bitmap = buildBitmap(fields);

    const de2 = '16' + '4111111111111111';
    const de3 = '000000';
    const de4 = '000000000500';
    const de7 = '0210120500';
    const de11 = '654321';
    const de12 = '120500';
    const de13 = '0210';
    const de37 = asciiToHex('000000123456');
    const de39 = asciiToHex('00');
    const de41 = asciiToHex('TERM0001');
    const de49 = numHex('840', 3);

    return mti + bitmap + de2 + de3 + de4 + de7 + de11 + de12 + de13 + de37 + de39 + de41 + de49;
}

function buildNetworkEcho(): string {
    const mti = '0800';
    const fields = [7, 11, 70]; // 70 > 64 → needs secondary bitmap
    const bitmap = buildDualBitmap(fields);

    const de7 = '0210120000';
    const de11 = '123456';
    const de70 = numHex('301', 3);  // Network Info Code: Echo Test

    return mti + bitmap + de7 + de11 + de70;
}

function buildFinancialPurchase(): string {
    const mti = '0200';
    const fields = [2, 3, 4, 7, 11, 12, 13, 14, 22, 25, 41, 42, 49];
    const bitmap = buildBitmap(fields);

    const de2 = '16' + '4999988887777666';
    const de3 = '000000';
    const de4 = '000000001250';        // $12.50
    const de7 = '0210143022';
    const de11 = '987654';
    const de12 = '143022';
    const de13 = '0210';
    const de14 = '2612';
    const de22 = numHex('091', 3);     // E-commerce
    const de25 = '08';                 // Mail/Phone order
    const de41 = asciiToHex('ECOM0001');
    const de42 = asciiToHex('ONLINESTORE1234');
    const de49 = numHex('840', 3);

    return mti + bitmap + de2 + de3 + de4 + de7 + de11 + de12 + de13 + de14 + de22 + de25 + de41 + de42 + de49;
}

// Inspired by moov-io reversal message structure
function buildRefundRequest(): string {
    const mti = '0200';
    const fields = [2, 3, 4, 7, 11, 12, 13, 22, 25, 37, 41, 42, 49];
    const bitmap = buildBitmap(fields);

    const de2 = '16' + '5500123456789012';   // Mastercard PAN
    const de3 = '200000';                      // Processing code: Refund
    const de4 = '000000003499';                // $34.99 refund
    const de7 = '0210154500';
    const de11 = '445566';
    const de12 = '154500';
    const de13 = '0210';
    const de22 = numHex('051', 3);             // Chip
    const de25 = '00';
    const de37 = asciiToHex('000000778899');    // Original RRN
    const de41 = asciiToHex('POS00042');
    const de42 = asciiToHex('RETAILSTORE5678');
    const de49 = numHex('840', 3);

    return mti + bitmap + de2 + de3 + de4 + de7 + de11 + de12 + de13 + de22 + de25 + de37 + de41 + de42 + de49;
}

function buildBalanceInquiry(): string {
    const mti = '0100';
    const fields = [2, 3, 7, 11, 12, 13, 14, 22, 25, 41, 42, 49];
    const bitmap = buildBitmap(fields);

    const de2 = '16' + '4000123456781234';
    const de3 = '300000';                      // Processing code: Balance Inquiry
    const de7 = '0210160000';
    const de11 = '112233';
    const de12 = '160000';
    const de13 = '0210';
    const de14 = '2803';                       // Expiry: Mar 2028
    const de22 = numHex('051', 3);             // Chip
    const de25 = '00';
    const de41 = asciiToHex('ATM00001');
    const de42 = asciiToHex('BANKBRANCH00001');
    const de49 = numHex('840', 3);

    return mti + bitmap + de2 + de3 + de7 + de11 + de12 + de13 + de14 + de22 + de25 + de41 + de42 + de49;
}

function buildSignOn(): string {
    const mti = '0800';
    const fields = [7, 11, 70];
    const bitmap = buildDualBitmap(fields);

    const de7 = '0210060000';      // Morning sign-on
    const de11 = '000001';         // First STAN of the day
    const de70 = numHex('001', 3); // Sign-On

    return mti + bitmap + de7 + de11 + de70;
}

// Restaurant POS with MCC and Track 2 data — exercises DE18 + DE35
function buildRestaurantPOS(): string {
    const mti = '0200';
    const fields = [2, 3, 4, 7, 11, 12, 13, 18, 22, 25, 35, 41, 42, 49];
    const bitmap = buildBitmap(fields);

    const de2 = '16' + '4532015112830366';   // Visa PAN
    const de3 = '000000';                     // Purchase
    const de4 = '000000004250';               // $42.50 dinner
    const de7 = '0210193000';
    const de11 = '887766';
    const de12 = '193000';
    const de13 = '0210';
    const de18 = '5812';                      // MCC: Restaurants
    const de22 = numHex('021', 3);            // Mag stripe
    const de25 = '00';
    // Track 2: PAN=ExpiryDate=ServiceCode+DiscretionaryData
    const de35 = asciiToHex('4532015112830366=2612101123400001');
    const de35len = (de35.length / 2).toString().padStart(2, '0');
    const de41 = asciiToHex('POS00099');
    const de42 = asciiToHex('ITALIANREST  99');
    const de49 = numHex('840', 3);

    return mti + bitmap + de2 + de3 + de4 + de7 + de11 + de12 + de13 + de18 + de22 + de25 + de35len + de35 + de41 + de42 + de49;
}

// Batch Settlement — exercises 0500 Reconciliation MTI
function buildBatchSettlement(): string {
    const mti = '0500';
    const fields = [7, 11, 12, 13, 41, 42, 49, 70];
    const bitmap = buildDualBitmap(fields);

    const de7 = '0210235959';            // End of day
    const de11 = '999999';               // Last STAN
    const de12 = '235959';
    const de13 = '0210';
    const de41 = asciiToHex('TERM0001');
    const de42 = asciiToHex('MERCHANT0001   ');  // Must be exactly 15 chars
    const de49 = numHex('840', 3);
    const de70 = numHex('161', 3);       // Reconciliation

    return mti + bitmap + de7 + de11 + de12 + de13 + de41 + de42 + de49 + de70;
}

// Financial Advice (Completion) — 0220 auth completion
function buildFinancialAdvice(): string {
    const mti = '0220';
    const fields = [2, 3, 4, 7, 11, 12, 13, 22, 25, 38, 39, 41, 42, 49];
    const bitmap = buildBitmap(fields);

    const de2 = '16' + '3782822463100050';   // Amex PAN
    const de3 = '000000';                     // Purchase
    const de4 = '000000125000';               // $1,250.00 hotel checkout
    const de7 = '0210140000';
    const de11 = '334455';
    const de12 = '140000';
    const de13 = '0210';
    const de22 = numHex('051', 3);            // Chip
    const de25 = '06';                        // Preauthorized
    const de38 = asciiToHex('HT7890');        // Auth code from original auth
    const de39 = asciiToHex('00');             // Approved (AN type = ASCII encoded)
    const de41 = asciiToHex('HTLPOS01');
    const de42 = asciiToHex('GRANDHOTEL    1');  // Must be exactly 15 chars
    const de49 = numHex('840', 3);

    return mti + bitmap + de2 + de3 + de4 + de7 + de11 + de12 + de13 + de22 + de25 + de38 + de39 + de41 + de42 + de49;
}

// ─── Preset Messages ──────────────────────────────────────────────

export const PRESET_MESSAGES: PresetMessage[] = [
    {
        id: 'auth-request',
        name: '☕ Coffee Purchase (Auth Request)',
        mti: '0100',
        scenario: 'You tap your card for a $5.00 coffee. The POS sends this message to ask: "Can this card spend $5?"',
        description: 'Authorization Request from Acquirer to Issuer',
        hex: buildAuthRequest(),
        highlights: ['DE2 (PAN)', 'DE4 (Amount: $5.00)', 'DE43 (Starbucks)'],
    },
    {
        id: 'auth-response-approved',
        name: '✅ Approved! (Auth Response)',
        mti: '0110',
        scenario: 'The issuing bank says YES — you got your coffee! Response Code 00 = Approved.',
        description: 'Authorization Response — Approved',
        hex: buildAuthResponseApproved(),
        highlights: ['DE38 (Auth Code: AB1234)', 'DE39 (Response: 00=Approved)'],
    },
    {
        id: 'auth-response-declined',
        name: '❌ Declined! (Insufficient Funds)',
        mti: '0110',
        scenario: 'The issuing bank says NO — not enough money in the account. Response Code 51 = Insufficient Funds.',
        description: 'Authorization Response — Declined (51)',
        hex: buildAuthResponseDeclined(),
        highlights: ['DE39 (Response: 51=Insufficient Funds)'],
    },
    {
        id: 'reversal',
        name: '↩️ Transaction Reversal (Ctrl+Z)',
        mti: '0420',
        scenario: 'Something went wrong — the POS timed out waiting for a response. It sends a reversal to undo any potential hold on the cardholder\'s funds.',
        description: 'Reversal Advice — Undo a potentially stuck transaction',
        hex: buildReversal(),
        highlights: ['MTI 0420 (Reversal)', 'DE11 (Original STAN)'],
    },
    {
        id: 'network-echo',
        name: '📡 Network Echo Test',
        mti: '0800',
        scenario: 'Before processing transactions, the terminal pings the network: "Are you alive?" This is the heartbeat of the payment system.',
        description: 'Network Management — Echo Test / Sign-On',
        hex: buildNetworkEcho(),
        highlights: ['MTI 0800 (Network Mgmt)', 'DE70 (Echo Test Code: 301)'],
    },
    {
        id: 'purchase-financial',
        name: '💳 E-Commerce Purchase (Financial)',
        mti: '0200',
        scenario: 'A combined auth+capture in one shot. Common in e-commerce where authorization and financial capture happen simultaneously.',
        description: 'Financial Transaction Request — Direct purchase',
        hex: buildFinancialPurchase(),
        highlights: ['MTI 0200 (Financial)', 'DE4 (Amount: $12.50)', 'DE22 (E-commerce)'],
    },
    {
        id: 'refund',
        name: '💸 Refund Request',
        mti: '0200',
        scenario: 'Original purchase returned. Terminal sends a financial message with Processing Code 20 (Refund) referencing the original RRN to return $34.99.',
        description: 'Financial Transaction — Refund (Processing Code 20)',
        hex: buildRefundRequest(),
        highlights: ['DE3 (Processing: 20=Refund)', 'DE37 (Original RRN)', 'DE4 ($34.99)'],
    },
    {
        id: 'balance-inquiry',
        name: '🏧 ATM Balance Inquiry',
        mti: '0100',
        scenario: 'Cardholder checks balance at the ATM. Processing Code 30 tells the issuer: "Don\'t charge anything — just tell me the balance."',
        description: 'Authorization Request — Balance Inquiry (Processing Code 30)',
        hex: buildBalanceInquiry(),
        highlights: ['DE3 (Processing: 30=Balance Inquiry)', 'No amount field (balance check only)'],
    },
    {
        id: 'sign-on',
        name: '🔑 Terminal Sign-On',
        mti: '0800',
        scenario: 'Every morning, the terminal "signs on" to the host: "I\'m terminal X, ready to process." DE70=001 means Sign-On. The host responds with encryption keys.',
        description: 'Network Management — Terminal Sign-On',
        hex: buildSignOn(),
        highlights: ['MTI 0800 (Network Mgmt)', 'DE70 (Sign-On: 001)'],
    },
    {
        id: 'restaurant-pos',
        name: '🍝 Restaurant POS (Track 2 + MCC)',
        mti: '0200',
        scenario: 'Waiter swipes card for a $42.50 dinner. Track 2 data from the mag stripe contains PAN, expiry, and service code. MCC 5812 = Restaurants.',
        description: 'Financial Transaction with Track 2 Data and Merchant Category Code',
        hex: buildRestaurantPOS(),
        highlights: ['DE18 (MCC: 5812=Restaurants)', 'DE35 (Track 2 Data)', 'DE22 (Mag Stripe)'],
    },
    {
        id: 'batch-settlement',
        name: '📊 End-of-Day Batch Settlement',
        mti: '0500',
        scenario: 'At 11:59 PM, the terminal sends a reconciliation request to settle the day\'s transactions. DE70=161 triggers the batch close process.',
        description: 'Reconciliation Request — Settle the day\'s batch',
        hex: buildBatchSettlement(),
        highlights: ['MTI 0500 (Reconciliation)', 'DE70 (161=Reconciliation)', 'End-of-day STAN 999999'],
    },
    {
        id: 'hotel-completion',
        name: '🏨 Hotel Checkout (Auth Completion)',
        mti: '0220',
        scenario: 'Guest checks out after 3 nights. The original card-present auth was for 1 night; now the hotel sends a 0220 Completion for the full $1,250 stay.',
        description: 'Financial Advice (Completion) — Finalize a previously authorized amount',
        hex: buildFinancialAdvice(),
        highlights: ['MTI 0220 (Completion)', 'DE25=06 (Preauthorized)', 'DE38 (Original Auth Code)', 'DE4 ($1,250.00)'],
    },
];

// ─── Learning Scenarios ───────────────────────────────────────────

export interface LearningScenario {
    id: string;
    title: string;
    icon: string;
    description: string;
    steps: string[];
    presetId: string;
}

export const LEARNING_SCENARIOS: LearningScenario[] = [
    {
        id: 'tap-to-pay',
        title: 'Tap-to-Pay Coffee Purchase',
        icon: '☕',
        description: 'Follow a $5 contactless payment from tap to approval in 200ms',
        steps: [
            'POS terminal reads your card via NFC (contactless)',
            'Terminal builds ISO 8583 message with MTI 0100 (Authorization Request)',
            'Bitmap marks which fields are present (PAN, Amount, etc.)',
            'Acquirer forwards to card network → Issuer',
            'Issuer checks balance, returns 0110 with Response Code 00',
            'Terminal displays "Approved" ✅',
        ],
        presetId: 'auth-request',
    },
    {
        id: 'declined',
        title: 'Card Declined at Checkout',
        icon: '🚫',
        description: 'What happens when "Insufficient Funds" — the dreaded Response Code 51',
        steps: [
            'Same flow as approval: 0100 sent to issuer',
            'Issuer checks balance: $3.50 available, $5.00 requested',
            'Returns 0110 with Response Code 51 (Insufficient Funds)',
            'Terminal displays "Declined" ❌',
            'No hold placed on funds — clean rejection',
        ],
        presetId: 'auth-response-declined',
    },
    {
        id: 'timeout-reversal',
        title: 'POS Timeout → Reversal',
        icon: '⏱️',
        description: 'Network hiccup! Terminal didn\'t get a response. Time for Ctrl+Z.',
        steps: [
            'Terminal sends 0100 but response never arrives (timeout)',
            'Problem: Did the issuer approve? Are funds held?',
            'Terminal sends 0420 (Reversal Advice) — "Undo whatever you did"',
            'Issuer releases any hold on cardholder funds',
            'Prevents ghost charges / double-billing',
        ],
        presetId: 'reversal',
    },
    {
        id: 'heartbeat',
        title: 'Network Heartbeat',
        icon: '💓',
        description: 'Terminal checks: "Is the network alive?" before taking transactions.',
        steps: [
            'Terminal sends 0800 with DE70 = 301 (Echo Test)',
            'Network/Host responds with 0810 confirming connectivity',
            'This happens before sign-on and periodically during operation',
            'If no response → terminal goes offline or uses stand-in',
        ],
        presetId: 'network-echo',
    },
    {
        id: 'ecommerce-flow',
        title: 'E-Commerce Checkout',
        icon: '🛒',
        description: 'Online purchase where auth and capture happen in a single 0200 Financial message.',
        steps: [
            'Customer enters card on checkout page (PCI-compliant tokenized)',
            'Payment gateway builds MTI 0200 (Financial Transaction)',
            'DE22=091 (E-Commerce) and DE25=08 (Mail/Phone Order) mark it as online',
            'Issuer authorizes and captures in one step',
            'Avoids the separate 0100/0220 auth-then-capture flow',
        ],
        presetId: 'purchase-financial',
    },
    {
        id: 'return-refund',
        title: 'In-Store Refund',
        icon: '💸',
        description: 'Customer returns a jacket. Processing Code 20 (Refund) credits the original PAN.',
        steps: [
            'Cashier scans receipt and swipes/inserts the original card',
            'Terminal sends 0200 with Processing Code 20xxxx (Refund)',
            'DE37 carries the original RRN so the issuer can match the return',
            'Issuer credits $34.99 back to cardholder\'s account',
            'Settlement nets the refund against today\'s batch',
        ],
        presetId: 'refund',
    },
    {
        id: 'restaurant-swipe',
        title: 'Restaurant Card Swipe (Track 2)',
        icon: '🍝',
        description: 'Waiter swipes card. Track 2 data contains PAN, expiry, service code — all from the mag stripe.',
        steps: [
            'Waiter swipes customer\'s card on POS terminal',
            'Mag stripe reader captures Track 2 data (DE35)',
            'Track 2 encodes: PAN + Separator + Expiry + Service Code + Discretionary',
            'DE18 (MCC=5812) tells network this is a restaurant',
            'Service code digit 1 indicates international/national chip or mag stripe',
            'Issuer sees the MCC and may apply dining-specific rules',
        ],
        presetId: 'restaurant-pos',
    },
    {
        id: 'batch-close',
        title: 'End-of-Day Batch Close',
        icon: '📊',
        description: 'Terminal settles all transactions at 11:59 PM. MTI 0500 triggers reconciliation.',
        steps: [
            'Terminal collects all approved transactions from today\'s batch',
            'Sends MTI 0500 (Reconciliation Request) with DE70=161',
            'Host compares terminal batch totals with its own records',
            'If balanced → 0510 response confirms settlement',
            'If mismatch → host triggers detail reconciliation (DE70=162)',
            'Funds transfer to merchant\'s account next business day',
        ],
        presetId: 'batch-settlement',
    },
    {
        id: 'hotel-checkout',
        title: 'Hotel Checkout (Completion)',
        icon: '🏨',
        description: 'Final billing for a multi-night stay. 0220 completes the original authorization.',
        steps: [
            'Guest checks in: hotel authorizes 1 night with MTI 0100',
            'Each night: hotel may send incremental auth (0100) or advice (0120)',
            'Checkout: hotel sends 0220 (Financial Advice) for total $1,250',
            'DE25=06 marks it as preauthorized completion',
            'DE38 carries original auth code to link back to initial auth',
            'Issuer releases the hold and posts the final charge',
        ],
        presetId: 'hotel-completion',
    },
];

