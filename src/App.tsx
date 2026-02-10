import { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import {
    Container,
    Textarea,
    TextInput,
    Select,
    Badge,
    Table,
    Tooltip,
    Alert,
    Tabs,
    Text,
    Title,
    Group,
    Stack,
    Paper,
    SimpleGrid,
    Accordion,
    Divider,
    ActionIcon,
    CopyButton,
    Box,
    UnstyledButton,
    Progress,
    RingProgress,
} from '@mantine/core';
import { useDebouncedValue, useMediaQuery } from '@mantine/hooks';
import {
    IconAlertTriangle,
    IconCheck,
    IconCopy,
    IconCreditCard,
    IconBinary,
    IconTable,
    IconCode,
    IconSchool,
    IconArrowRight,
    IconX,
    IconWifi,
    IconRefresh,
    IconShieldCheck,
    IconInfoCircle,
    IconSearch,
    IconChartBar,
    IconShare,
    IconDownload,
    IconLink,
    IconFileText,
} from '@tabler/icons-react';
import { parseISO8583, ParseResult } from './parser';
import { PRESET_MESSAGES, LEARNING_SCENARIOS } from './presets';
import { FIELD_SPECS, PROCESSING_CODES, RESPONSE_CODES, CURRENCY_CODES } from './fieldSpecs';
import { MCC_DATABASE } from './mccDatabase';

const CATEGORY_COLORS: Record<string, string> = {
    mti: '#8b5cf6',
    bitmap: '#3b82f6',
    identification: '#ec4899',
    amount: '#22c55e',
    processing: '#f97316',
    date_time: '#06b6d4',
    reference: '#a855f7',
    network: '#0ea5e9',
    terminal: '#eab308',
    security: '#ef4444',
    private: '#6b7280',
    reserved: '#6b7280',
    error: '#ef4444',
};

const CATEGORY_LABELS: Record<string, string> = {
    identification: 'Card / ID',
    amount: 'Amount',
    processing: 'Processing',
    date_time: 'Date / Time',
    reference: 'Reference',
    network: 'Network',
    terminal: 'Terminal',
    security: 'Security',
    private: 'Private',
    reserved: 'Reserved',
};

function getCategoryLabel(cat: string): string {
    return CATEGORY_LABELS[cat] || cat.toUpperCase();
}

// ─── Luhn Validator ────────────────────────────────────────────────
function validateLuhn(cardNumber: string): boolean {
    const digits = cardNumber.replace(/\D/g, '');
    if (digits.length < 13 || digits.length > 19) return false;
    let sum = 0;
    let isEven = false;
    for (let i = digits.length - 1; i >= 0; i--) {
        let d = parseInt(digits[i], 10);
        if (isEven) { d *= 2; if (d > 9) d -= 9; }
        sum += d;
        isEven = !isEven;
    }
    return sum % 10 === 0;
}

// ─── BIN Data Lookup ───────────────────────────────────────────────
interface BinInfo {
    brand: string;
    type: string;
    category: string;
    issuer: string;
    country: string;
}

let binDataCache: Map<string, BinInfo> | null = null;
let binDataLoading = false;
const binDataListeners: Array<() => void> = [];

function useBinData() {
    const [binMap, setBinMap] = useState<Map<string, BinInfo> | null>(binDataCache);

    useEffect(() => {
        if (binDataCache) { setBinMap(binDataCache); return; }
        if (binDataLoading) {
            const listener = () => setBinMap(binDataCache);
            binDataListeners.push(listener);
            return () => { const idx = binDataListeners.indexOf(listener); if (idx >= 0) binDataListeners.splice(idx, 1); };
        }
        binDataLoading = true;
        const basePath = import.meta.env.BASE_URL || '/';
        fetch(`${basePath}bin-list-data.csv`, { cache: 'force-cache' })
            .then(res => res.text())
            .then(data => {
                const rows = data.split('\n').filter(r => r.trim());
                const headers = rows[0].split(',').map(h => h.trim().replace(/"/g, ''));
                const map = new Map<string, BinInfo>();
                const idxBIN = headers.indexOf('BIN');
                const idxBrand = headers.indexOf('Brand');
                const idxType = headers.indexOf('Type');
                const idxCategory = headers.indexOf('Category');
                const idxIssuer = headers.indexOf('Issuer');
                const idxCountry = headers.indexOf('CountryName');

                for (let i = 1; i < rows.length; i++) {
                    // Parse CSV with quoted fields
                    const cols: string[] = [];
                    let current = '', inQuotes = false;
                    for (const ch of rows[i]) {
                        if (ch === '"') { inQuotes = !inQuotes; }
                        else if (ch === ',' && !inQuotes) { cols.push(current.trim()); current = ''; }
                        else { current += ch; }
                    }
                    cols.push(current.trim());

                    const bin = cols[idxBIN];
                    if (bin) {
                        map.set(bin, {
                            brand: cols[idxBrand] || 'Unknown',
                            type: cols[idxType] || 'Unknown',
                            category: cols[idxCategory] || 'Unknown',
                            issuer: cols[idxIssuer] || 'Unknown',
                            country: cols[idxCountry] || 'Unknown',
                        });
                    }
                }
                binDataCache = map;
                setBinMap(map);
                binDataListeners.forEach(fn => fn());
                binDataListeners.length = 0;
                binDataLoading = false;
            })
            .catch(() => { binDataLoading = false; });
    }, []);

    const lookup = useCallback((pan: string): BinInfo | null => {
        if (!binMap) return null;
        const digits = pan.replace(/\D/g, '');
        // Try 8, 7, 6 digit BIN prefix (most specific first)
        for (const len of [8, 7, 6]) {
            const prefix = digits.substring(0, len);
            const info = binMap.get(prefix);
            if (info) return info;
        }
        return null;
    }, [binMap]);

    return { lookup, loading: !binMap && binDataLoading };
}

// ─── MTI Dictionary (from moov-io/iso8583 constant.go) ────────────
const MTI_DESCRIPTIONS: Record<string, string> = {
    '0100': 'Authorization Request',
    '0110': 'Authorization Response',
    '0120': 'Authorization Advice',
    '0121': 'Authorization Advice Repeat',
    '0130': 'Issuer Response to Authorization Advice',
    '0180': 'Authorization Positive Acknowledgement',
    '0190': 'Authorization Negative Acknowledgement',
    '0200': 'Financial Transaction Request',
    '0210': 'Financial Transaction Response',
    '0220': 'Financial Transaction Advice (Completion)',
    '0221': 'Financial Transaction Advice Repeat',
    '0230': 'Issuer Response to Financial Advice',
    '0320': 'Batch Upload / File Update Advice',
    '0330': 'Batch Upload Response',
    '0400': 'Acquirer Reversal Request',
    '0410': 'Acquirer Reversal Response',
    '0420': 'Acquirer Reversal Advice',
    '0430': 'Acquirer Reversal Advice Response',
    '0500': 'Acquirer Reconciliation Request',
    '0510': 'Batch Settlement Response',
    '0520': 'Acquirer Reconciliation Advice',
    '0530': 'Acquirer Reconciliation Advice Response',
    '0600': 'Administrative Request',
    '0610': 'Administrative Response',
    '0620': 'Administrative Advice',
    '0630': 'Administrative Advice Response',
    '0800': 'Network Management Request',
    '0810': 'Network Management Response',
    '0820': 'Network Management Advice (Key Change)',
};


// ─── Expanded Currency Database (ISO 4217) ────────────────────────
const CURRENCY_DB: Record<string, { code: string; name: string; symbol: string; minor: number }> = {
    '008': { code: 'ALL', name: 'Albanian Lek', symbol: 'L', minor: 2 },
    '012': { code: 'DZD', name: 'Algerian Dinar', symbol: 'د.ج', minor: 2 },
    '032': { code: 'ARS', name: 'Argentine Peso', symbol: '$', minor: 2 },
    '036': { code: 'AUD', name: 'Australian Dollar', symbol: 'A$', minor: 2 },
    '050': { code: 'BDT', name: 'Bangladeshi Taka', symbol: '৳', minor: 2 },
    '124': { code: 'CAD', name: 'Canadian Dollar', symbol: 'C$', minor: 2 },
    '144': { code: 'LKR', name: 'Sri Lankan Rupee', symbol: 'Rs', minor: 2 },
    '156': { code: 'CNY', name: 'Chinese Yuan', symbol: '¥', minor: 2 },
    '170': { code: 'COP', name: 'Colombian Peso', symbol: '$', minor: 2 },
    '191': { code: 'HRK', name: 'Croatian Kuna', symbol: 'kn', minor: 2 },
    '203': { code: 'CZK', name: 'Czech Koruna', symbol: 'Kč', minor: 2 },
    '208': { code: 'DKK', name: 'Danish Krone', symbol: 'kr', minor: 2 },
    '344': { code: 'HKD', name: 'Hong Kong Dollar', symbol: 'HK$', minor: 2 },
    '348': { code: 'HUF', name: 'Hungarian Forint', symbol: 'Ft', minor: 2 },
    '356': { code: 'INR', name: 'Indian Rupee', symbol: '₹', minor: 2 },
    '360': { code: 'IDR', name: 'Indonesian Rupiah', symbol: 'Rp', minor: 2 },
    '376': { code: 'ILS', name: 'Israeli Shekel', symbol: '₪', minor: 2 },
    '392': { code: 'JPY', name: 'Japanese Yen', symbol: '¥', minor: 0 },
    '410': { code: 'KRW', name: 'South Korean Won', symbol: '₩', minor: 0 },
    '458': { code: 'MYR', name: 'Malaysian Ringgit', symbol: 'RM', minor: 2 },
    '484': { code: 'MXN', name: 'Mexican Peso', symbol: '$', minor: 2 },
    '554': { code: 'NZD', name: 'New Zealand Dollar', symbol: 'NZ$', minor: 2 },
    '578': { code: 'NOK', name: 'Norwegian Krone', symbol: 'kr', minor: 2 },
    '586': { code: 'PKR', name: 'Pakistani Rupee', symbol: '₨', minor: 2 },
    '604': { code: 'PEN', name: 'Peruvian Sol', symbol: 'S/', minor: 2 },
    '608': { code: 'PHP', name: 'Philippine Peso', symbol: '₱', minor: 2 },
    '634': { code: 'QAR', name: 'Qatari Riyal', symbol: 'ر.ق', minor: 2 },
    '643': { code: 'RUB', name: 'Russian Ruble', symbol: '₽', minor: 2 },
    '682': { code: 'SAR', name: 'Saudi Riyal', symbol: 'ر.س', minor: 2 },
    '702': { code: 'SGD', name: 'Singapore Dollar', symbol: 'S$', minor: 2 },
    '710': { code: 'ZAR', name: 'South African Rand', symbol: 'R', minor: 2 },
    '752': { code: 'SEK', name: 'Swedish Krona', symbol: 'kr', minor: 2 },
    '756': { code: 'CHF', name: 'Swiss Franc', symbol: 'CHF', minor: 2 },
    '764': { code: 'THB', name: 'Thai Baht', symbol: '฿', minor: 2 },
    '784': { code: 'AED', name: 'UAE Dirham', symbol: 'د.إ', minor: 2 },
    '818': { code: 'EGP', name: 'Egyptian Pound', symbol: '£', minor: 2 },
    '826': { code: 'GBP', name: 'British Pound', symbol: '£', minor: 2 },
    '840': { code: 'USD', name: 'US Dollar', symbol: '$', minor: 2 },
    '858': { code: 'UYU', name: 'Uruguayan Peso', symbol: '$U', minor: 2 },
    '901': { code: 'TWD', name: 'New Taiwan Dollar', symbol: 'NT$', minor: 2 },
    '936': { code: 'GHS', name: 'Ghanaian Cedi', symbol: '₵', minor: 2 },
    '949': { code: 'TRY', name: 'Turkish Lira', symbol: '₺', minor: 2 },
    '978': { code: 'EUR', name: 'Euro', symbol: '€', minor: 2 },
    '985': { code: 'PLN', name: 'Polish Zloty', symbol: 'zł', minor: 2 },
    '986': { code: 'BRL', name: 'Brazilian Real', symbol: 'R$', minor: 2 },
};

// ─── Service Code Decoder (from moov-io track2.go) ────────────────
const SERVICE_CODE_D1: Record<string, string> = {
    '1': 'International (Chip)', '2': 'International (Mag Stripe)',
    '5': 'National (Chip)', '6': 'National (Mag Stripe)',
    '7': 'Private (Chip)', '9': 'Test',
};
const SERVICE_CODE_D2: Record<string, string> = {
    '0': 'Normal Authorization', '2': 'Positive Auth by Issuer',
    '4': 'Positive Auth unless explicit deny', '5': 'No restrictions',
    '6': 'Prompt for Auth if suspicious', '7': 'Prompt for Auth',
};
const SERVICE_CODE_D3: Record<string, string> = {
    '0': 'No restrictions, PIN required', '1': 'No restrictions',
    '2': 'Goods & Services only', '3': 'ATM only, PIN required',
    '4': 'Cash only', '5': 'Goods & Services only, PIN required',
    '6': 'No restrictions, prompt for PIN', '7': 'Goods & Services only, prompt for PIN',
};

function decodeServiceCode(sc: string): string {
    if (sc.length !== 3) return '';
    const d1 = SERVICE_CODE_D1[sc[0]] || 'Unknown';
    const d2 = SERVICE_CODE_D2[sc[1]] || 'Unknown';
    const d3 = SERVICE_CODE_D3[sc[2]] || 'Unknown';
    return `[${sc[0]}] ${d1} | [${sc[1]}] ${d2} | [${sc[2]}] ${d3}`;
}

// ─── Track 2 Parser (regex from moov-io field/track2.go) ──────────
function parseTrack2(value: string): string {
    // moov-io regex: ^([0-9]{1,19})(=|D)([0-9]{4})([0-9]{3})([^?]+)$
    const match = value.match(/^([0-9]{1,19})(=|D)([0-9]{4})([0-9]{3})(.+)$/);
    if (!match) return value;
    const [, pan, , expiry, svcCode, disc] = match;
    const maskedPan = pan.length >= 8 ? pan.slice(0, 4) + '••••' + pan.slice(-4) : pan;
    const months = ['', 'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const expM = parseInt(expiry.slice(2, 4), 10);
    const expStr = `${months[expM] || '??'} 20${expiry.slice(0, 2)}`;
    return `PAN: ${maskedPan} | Exp: ${expStr} | Svc: ${svcCode} (${decodeServiceCode(svcCode)}) | Disc: ${disc}`;
}

// ─── Value Enrichment ─────────────────────────────────────────────
function enrichValue(de: number, value: string): string {
    // Processing Code
    if (de === 3 && value.length >= 2) {
        const code = value.substring(0, 2);
        return PROCESSING_CODES[code] ? `${value} (${PROCESSING_CODES[code]})` : value;
    }
    // Amounts — use currency context if available
    if (de === 4 || de === 5 || de === 6) {
        const num = parseInt(value, 10);
        if (!isNaN(num)) return `${value} → $${(num / 100).toFixed(2)}`;
    }
    // Date Transmission MMDDhhmmss
    if (de === 7 && value.length === 10) {
        const mm = value.slice(0, 2), dd = value.slice(2, 4);
        const hh = value.slice(4, 6), mi = value.slice(6, 8), ss = value.slice(8, 10);
        return `${value} → ${mm}/${dd} ${hh}:${mi}:${ss}`;
    }
    // Time hhmmss
    if (de === 12 && value.length === 6) {
        return `${value} → ${value.slice(0, 2)}:${value.slice(2, 4)}:${value.slice(4, 6)}`;
    }
    // Date MMDD
    if ((de === 13 || de === 15 || de === 16 || de === 17) && value.length === 4) {
        const months = ['', 'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        const m = parseInt(value.slice(0, 2), 10);
        return `${value} → ${months[m] || '??'} ${value.slice(2, 4)}`;
    }
    // Expiry YYMM
    if (de === 14 && value.length === 4) {
        const months = ['', 'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        const m = parseInt(value.slice(2, 4), 10);
        return `${value} → ${months[m] || '??'} 20${value.slice(0, 2)}`;
    }
    // Merchant Category Code (DE18) — ISO 18245 (1088 codes)
    if (de === 18 && value.length === 4) {
        const entry = MCC_DATABASE[value];
        return entry ? `${value} (${entry.desc}) [${entry.groupLabel}]` : value;
    }
    // POS entry mode
    if (de === 22 && value.length >= 2) {
        const modes: Record<string, string> = {
            '00': 'Unspecified', '01': 'Manual', '02': 'Mag Stripe',
            '05': 'Chip (ICC)', '07': 'Contactless (NFC)',
            '09': 'E-commerce', '10': 'Credentials on File',
            '79': 'Mag Stripe Fallback', '80': 'Chip Fallback to Mag',
            '91': 'Contactless Chip',
        };
        const mode = modes[value.substring(0, 2)];
        return mode ? `${value} (${mode})` : value;
    }
    // POS condition
    if (de === 25) {
        const conditions: Record<string, string> = {
            '00': 'Normal', '01': 'Cardholder not present', '02': 'Unattended terminal',
            '05': 'Customer present, card not present', '06': 'Preauthorized request',
            '08': 'Mail/Phone order', '51': 'Account verification',
            '59': 'E-commerce', '71': 'ATM withdrawal',
        };
        return conditions[value] ? `${value} (${conditions[value]})` : value;
    }
    // Track 2 Data (DE35) — structured parsing from moov-io field/track2.go
    if (de === 35) {
        return parseTrack2(value);
    }
    // Response code
    if (de === 39 && value.length >= 2) {
        const code = value.substring(0, 2);
        const info = RESPONSE_CODES[code];
        return info ? `${value} (${info.text})` : value;
    }
    // Track 1 Data (DE45) — mask PAN (from moov-io field_filter.go Track1Filter)
    if (de === 45 && value.includes('^')) {
        const parts = value.split('^');
        if (parts.length >= 3) {
            const panPart = parts[0].replace(/^[A-Z]/, '');
            const maskedPan = panPart.length >= 8 ? panPart.slice(0, 4) + '••••' + panPart.slice(-4) : panPart;
            return `PAN: ${maskedPan} | Name: ${parts[1].trim()} | ${parts.slice(2).join('^')}`;
        }
    }
    // Currency codes (DE49/50/51) — expanded ISO 4217 database
    if (de === 49 || de === 50 || de === 51) {
        const cur = CURRENCY_DB[value];
        if (cur) return `${value} (${cur.code} — ${cur.name} ${cur.symbol})`;
        const info = CURRENCY_CODES[value];
        return info ? `${value} (${info})` : value;
    }
    // PIN Data (DE52) — mask like moov-io field_filter.go PINFilter
    if (de === 52 && value.length >= 4) {
        return value.slice(0, 2) + '••••••' + value.slice(-2) + ' (PIN Block)';
    }
    // EMV Data (DE55) — truncate like moov-io field_filter.go EMVFilter
    if (de === 55 && value.length > 8) {
        return value.slice(0, 4) + ' ... ' + value.slice(-4) + ` (${value.length} chars EMV/ICC data)`;
    }
    // Network Information Code (DE70)
    if (de === 70) {
        const codes: Record<string, string> = {
            '001': 'Sign-on', '002': 'Sign-off', '003': 'Key Change',
            '101': 'Logon', '161': 'Reconciliation', '162': 'Reconciliation (Partial)',
            '163': 'Reconciliation (Final)', '181': 'Positive Acknowledgement',
            '190': 'Negative Acknowledgement', '201': 'Key Exchange',
            '202': 'MAC Key Exchange', '281': 'Function Request',
            '282': 'Function Response', '301': 'Echo Test',
            '302': 'Key Data Echo Test', '370': 'Alert Notification',
        };
        return codes[value] ? `${value} (${codes[value]})` : value;
    }
    // Original Data Elements (DE90)
    if (de === 90 && value.length >= 42) {
        const origMti = value.slice(0, 4);
        const origStan = value.slice(4, 10);
        const origDate = value.slice(10, 20);
        return `MTI:${origMti} STAN:${origStan} Date:${origDate} ...`;
    }
    return value;
}

// Mask PAN for display
function maskPAN(value: string): string {
    if (value.length >= 13) {
        return value.slice(0, 6) + '••••' + value.slice(-4);
    }
    return value;
}

// ─── Message Statistics ───────────────────────────────────────────
function MessageStats({ result }: { result: ParseResult }) {
    const isMobile = useMediaQuery('(max-width: 768px)');
    const stats = useMemo(() => {
        const categoryCount: Record<string, number> = {};
        const categoryBytes: Record<string, number> = {};
        let totalFieldBytes = 0;
        let fixedCount = 0;
        let variableCount = 0;
        let largestField = { de: 0, name: '', bytes: 0 };

        result.fields.forEach(f => {
            categoryCount[f.category] = (categoryCount[f.category] || 0) + 1;
            const fieldBytes = f.rawHex.length / 2;
            categoryBytes[f.category] = (categoryBytes[f.category] || 0) + fieldBytes;
            totalFieldBytes += fieldBytes;
            if (f.format === 'FIXED') fixedCount++;
            else variableCount++;
            if (fieldBytes > largestField.bytes) {
                largestField = { de: f.de, name: f.name, bytes: fieldBytes };
            }
        });

        const sortedCategories = Object.entries(categoryCount)
            .sort((a, b) => (categoryBytes[b[0]] || 0) - (categoryBytes[a[0]] || 0));

        // Message composition: MTI(2) + Bitmap(8 or 16) + fields
        const bitmapBytes = result.secondaryBitmap ? 16 : 8;
        const mtiBytes = 2;
        const overhead = mtiBytes + bitmapBytes;
        const totalBytes = overhead + totalFieldBytes;
        const payloadPct = Math.round((totalFieldBytes / totalBytes) * 100);

        return { categoryCount, categoryBytes, sortedCategories, totalBytes, overhead, totalFieldBytes, bitmapBytes, mtiBytes, payloadPct, fixedCount, variableCount, largestField };
    }, [result]);

    const statBoxStyle = { cursor: 'help', display: 'flex', flexDirection: 'column' as const, alignItems: 'center' as const, justifyContent: 'flex-end' as const, minHeight: isMobile ? 'auto' : 80 };
    const ringSize = isMobile ? 48 : 64;

    return (
        <Paper className="brut-card" p="lg">
            <Group gap={6} mb="md">
                <IconChartBar size={18} />
                <Text fw={700} size="sm">Message Anatomy</Text>
            </Group>

            {/* ── Quick Stats Row ── */}
            <SimpleGrid cols={{ base: 2, sm: 4 }} spacing={isMobile ? 'xs' : 'md'} mb="lg">
                <Tooltip label="Total message size: MTI + Bitmap + all field data" withArrow>
                    <Box style={statBoxStyle}>
                        <Text ff="JetBrains Mono, monospace" fw={800} size={isMobile ? 'lg' : 'xl'} c="var(--ink-primary)">
                            {stats.totalBytes}
                        </Text>
                        <Text size="xs" c="dimmed" tt="uppercase" fw={600} lts={0.5}>
                            Total Bytes
                        </Text>
                    </Box>
                </Tooltip>
                <Tooltip label={`${result.fields.length} data elements parsed from this message`} withArrow>
                    <Box style={statBoxStyle}>
                        <Text ff="JetBrains Mono, monospace" fw={800} size={isMobile ? 'lg' : 'xl'} c="var(--ink-primary)">
                            {result.fields.length}
                        </Text>
                        <Text size="xs" c="dimmed" tt="uppercase" fw={600} lts={0.5}>
                            Data Elements
                        </Text>
                    </Box>
                </Tooltip>
                <Tooltip label={`${stats.fixedCount} fixed-length + ${stats.variableCount} variable-length fields`} withArrow>
                    <Box style={statBoxStyle}>
                        <Text ff="JetBrains Mono, monospace" fw={800} size={isMobile ? 'lg' : 'xl'} c="var(--ink-primary)">
                            {stats.fixedCount}:{stats.variableCount}
                        </Text>
                        <Text size="xs" c="dimmed" tt="uppercase" fw={600} lts={0.5}>
                            Fixed : Variable
                        </Text>
                    </Box>
                </Tooltip>
                <Tooltip label={`${stats.payloadPct}% of message bytes carry actual field data.\n${stats.overhead}B overhead (${stats.mtiBytes}B MTI + ${stats.bitmapBytes}B bitmap)\n${stats.totalFieldBytes}B field payload`} withArrow multiline w={260}>
                    <Box style={statBoxStyle}>
                        <RingProgress
                            size={ringSize}
                            thickness={isMobile ? 5 : 6}
                            rootColor="var(--border-subtle)"
                            sections={[
                                { value: ((stats.overhead) / stats.totalBytes) * 100, color: '#3b82f6', tooltip: `Overhead: ${stats.overhead}B` },
                                { value: (stats.totalFieldBytes / stats.totalBytes) * 100, color: '#22c55e', tooltip: `Payload: ${stats.totalFieldBytes}B` },
                            ]}
                            label={
                                <Text fw={700} size="xs" ta="center">
                                    {stats.payloadPct}%
                                </Text>
                            }
                        />
                        <Text size="xs" c="dimmed" tt="uppercase" fw={600} lts={0.5} mt={4}>
                            Payload
                        </Text>
                    </Box>
                </Tooltip>
            </SimpleGrid>



            {/* ── Bytes per Category ── */}
            <Text size="xs" fw={600} c="dimmed" mb={8} tt="uppercase" lts={0.5}>
                Bytes by Category
            </Text>
            <Stack gap={8}>
                {stats.sortedCategories.map(([cat, count]) => {
                    const bytes = stats.categoryBytes[cat] || 0;
                    const pct = Math.round((bytes / stats.totalFieldBytes) * 100);
                    return (
                        <Tooltip key={cat} label={`${getCategoryLabel(cat)}: ${count} field${count !== 1 ? 's' : ''} using ${bytes} bytes (${pct}% of payload)`} withArrow>
                            <Group gap="xs" wrap="nowrap" style={{ cursor: 'help' }}>
                                <Box w={8} h={8} style={{ borderRadius: 2, background: CATEGORY_COLORS[cat], flexShrink: 0 }} />
                                <Text size="xs" w={isMobile ? 55 : 80} fw={500} style={{ fontSize: isMobile ? 10 : undefined }}>{getCategoryLabel(cat)}</Text>
                                <Progress
                                    value={pct}
                                    color={CATEGORY_COLORS[cat]}
                                    size={isMobile ? 'sm' : 'md'}
                                    style={{ flex: 1, minWidth: isMobile ? 40 : 60 }}
                                    radius="sm"
                                />
                                <Text size="xs" ff="monospace" w={isMobile ? 40 : 56} ta="right" c="dimmed" style={{ fontSize: isMobile ? 10 : undefined }}>{bytes}B</Text>
                            </Group>
                        </Tooltip>
                    );
                })}
            </Stack>

            {/* ── Largest Field ── */}
            {stats.largestField.de > 0 && (
                <Text size="xs" c="dimmed" mt="md" ta="center" fs="italic">
                    Largest field: DE{stats.largestField.de} ({stats.largestField.name}) — {stats.largestField.bytes} bytes
                </Text>
            )}
        </Paper>
    );
}

// ─── Export as JSON ────────────────────────────────────────────────
function resultToJSON(result: ParseResult): string {
    const obj: Record<string, unknown> = {
        mti: result.mti?.raw,
        mtiDescription: result.mti?.description,
        mtiFullName: MTI_DESCRIPTIONS[result.mti?.raw || ''],
        primaryBitmap: result.primaryBitmap?.rawHex,
        fields: {} as Record<string, { name: string; value: string; rawHex: string; format: string; enriched: string }>,
    };
    result.fields.forEach(f => {
        (obj.fields as Record<string, unknown>)[`DE${f.de}`] = {
            name: f.name,
            value: f.decodedValue,
            enriched: enrichValue(f.de, f.decodedValue),
            rawHex: f.rawHex,
            format: f.format,
        };
    });
    return JSON.stringify(obj, null, 2);
}

// ─── Describe() Text Output (moov-io describe.go style) ───────────
function resultToText(result: ParseResult): string {
    const lines: string[] = [];
    const mtiName = MTI_DESCRIPTIONS[result.mti?.raw || ''] || result.mti?.description || '';
    lines.push(`ISO 8583 Message:`);
    lines.push(`MTI........: ${result.mti?.raw || '????'} (${mtiName})`);
    if (result.primaryBitmap) {
        lines.push(`Bitmap HEX.: ${result.primaryBitmap.rawHex}`);
        lines.push(`Bitmap bits: ${result.primaryBitmap.binary}`);
    }
    lines.push(`---`);
    result.fields.forEach(f => {
        const dePad = `DE${f.de}`.padEnd(5);
        const namePad = f.name.padEnd(40, '.');
        const enriched = enrichValue(f.de, f.decodedValue);
        const display = (f.de === 2 || f.de === 20) ? maskPAN(enriched) : enriched;
        lines.push(`${dePad} ${namePad}: ${display}`);
    });
    if (result.errors.length > 0) {
        lines.push(``);
        lines.push(`Unpacking Errors:`);
        result.errors.forEach(e => lines.push(`- ${e}`));
    }
    return lines.join('\n');
}

// ─── Share URL ────────────────────────────────────────────────────
function encodeHexToHash(hex: string): string {
    return '#hex=' + encodeURIComponent(hex);
}

function decodeHexFromHash(): string {
    const hash = window.location.hash;
    if (hash.startsWith('#hex=')) {
        return decodeURIComponent(hash.slice(5));
    }
    return '';
}

// ─── MTI Decoder Component ────────────────────────────────────────
function MTIDecoder({ mti }: { mti: ParseResult['mti'] }) {
    if (!mti) return null;

    const cells = [
        { label: 'Version', digit: mti.version.code, value: mti.version.label, color: '#8b5cf6' },
        { label: 'Class', digit: mti.messageClass.code, value: mti.messageClass.label, color: '#3b82f6' },
        { label: 'Function', digit: mti.function.code, value: mti.function.label, color: '#22c55e' },
        { label: 'Origin', digit: mti.origin.code, value: mti.origin.label, color: '#f97316' },
    ];

    const fullName = MTI_DESCRIPTIONS[mti.raw] || mti.description;

    return (
        <Box>
            <Group gap={6} mb="sm">
                <IconCreditCard size={20} />
                <Text fw={700} size="sm">Message Type Indicator</Text>
                <Badge color="dark" variant="filled" size="lg" ff="JetBrains Mono, monospace">
                    {mti.raw}
                </Badge>
            </Group>
            <Text size="sm" c="dimmed" mb={4}>{fullName}</Text>
            {fullName !== mti.description && (
                <Text size="xs" c="dimmed" mb="md" fs="italic">{mti.description}</Text>
            )}
            <div className="mti-grid">
                {cells.map((cell, i) => (
                    <Tooltip key={i} label={`Position ${i + 1}: ${cell.label}`} withArrow>
                        <div className="mti-cell">
                            <span className="digit" style={{ color: cell.color }}>{cell.digit}</span>
                            <span className="label">{cell.label}</span>
                            <span className="value">{cell.value}</span>
                        </div>
                    </Tooltip>
                ))}
            </div>
        </Box>
    );
}

// ─── Bitmap Visualizer ────────────────────────────────────────────
function BitmapVisualizer({ bitmap, offset = 0, highlightedDe, onFieldClick }: {
    bitmap: ParseResult['primaryBitmap'];
    offset?: number;
    highlightedDe: number | null;
    onFieldClick: (de: number) => void;
}) {
    if (!bitmap) return null;
    const bits = bitmap.binary.split('');

    return (
        <Box>
            <Group gap={6} mb="xs">
                <IconBinary size={18} />
                <Text fw={700} size="sm">{offset === 0 ? 'Primary' : 'Secondary'} Bitmap</Text>
                <Text size="xs" c="dimmed" ff="JetBrains Mono, monospace">{bitmap.rawHex}</Text>
            </Group>
            <Text size="xs" c="dimmed" mb="sm">
                {bitmap.activeFields.length} active field{bitmap.activeFields.length !== 1 ? 's' : ''}
                {offset === 0 && bitmap.hasSecondary && ' • Secondary bitmap present'}
            </Text>
            <div className="bitmap-grid">
                {bits.map((bit, i) => {
                    const fieldNum = i + 1 + offset;
                    const spec = FIELD_SPECS[fieldNum];
                    const isActive = bit === '1';
                    const isHighlighted = highlightedDe === fieldNum;
                    return (
                        <Tooltip
                            key={i}
                            label={`Bit ${fieldNum}: ${spec ? spec.name : (fieldNum === 1 && offset === 0 ? 'Secondary Bitmap Flag' : 'Reserved')} ${isActive ? '(ON)' : '(OFF)'}`}
                            withArrow multiline w={220}
                        >
                            <div
                                className={`bitmap-cell ${isActive ? 'active' : 'inactive'}`}
                                onClick={() => isActive && onFieldClick(fieldNum)}
                                style={{
                                    outline: isHighlighted ? '2px solid #C19A8A' : undefined,
                                    transform: isHighlighted ? 'scale(1.2)' : undefined,
                                    zIndex: isHighlighted ? 20 : undefined,
                                    cursor: isActive ? 'pointer' : 'default',
                                }}
                            >
                                {fieldNum}
                            </div>
                        </Tooltip>
                    );
                })}
            </div>
        </Box>
    );
}

// ─── Hex Annotator ────────────────────────────────────────────────
function HexAnnotator({ segments, highlightedDe, onFieldHover }: {
    segments: ParseResult['hexSegments'];
    highlightedDe: number | null;
    onFieldHover: (de: number | null) => void;
}) {
    if (segments.length === 0) return null;

    return (
        <Box>
            <Group gap={6} mb="sm">
                <IconCode size={18} />
                <Text fw={700} size="sm">Hex Annotator</Text>
                <Text size="xs" c="dimmed">Click to see which bytes map to which field</Text>
            </Group>
            <div className="hex-annotator">
                {segments.map((seg, i) => (
                    <Tooltip key={i} label={seg.label} withArrow>
                        <span
                            className={`hex-segment cat-${seg.category}`}
                            onClick={() => seg.de !== undefined && onFieldHover(highlightedDe === seg.de ? null : seg.de)}
                            style={{
                                cursor: seg.de !== undefined ? 'pointer' : undefined,
                                outline: highlightedDe !== null && seg.de === highlightedDe ? '2px solid white' : undefined,
                                filter: highlightedDe !== null && seg.de !== highlightedDe && seg.de !== undefined ? 'brightness(0.5)' : undefined,
                            }}
                        >
                            {seg.hex}
                        </span>
                    </Tooltip>
                ))}
            </div>
            {/* Color Legend */}
            <Group gap={4} mt="sm" wrap="wrap">
                {['mti', 'bitmap', 'identification', 'amount', 'processing', 'date_time', 'terminal', 'reference', 'network', 'security'].map(cat => (
                    <Badge
                        key={cat}
                        size="xs"
                        variant="light"
                        styles={{ root: { fontSize: 9, height: 18, paddingLeft: 4, paddingRight: 6 } }}
                        leftSection={<Box w={6} h={6} style={{ borderRadius: 2, background: CATEGORY_COLORS[cat] }} />}
                    >
                        {getCategoryLabel(cat)}
                    </Badge>
                ))}
            </Group>
        </Box>
    );
}

// ─── Field Table ──────────────────────────────────────────────────
function FieldTable({ fields, highlightedDe, onFieldHover, onFieldClick }: {
    fields: ParseResult['fields'];
    highlightedDe: number | null;
    onFieldHover: (de: number | null) => void;
    onFieldClick: (de: number) => void;
}) {
    if (fields.length === 0) return null;
    const isMobile = useMediaQuery('(max-width: 768px)');
    const rowRefs = useRef<Record<number, HTMLTableRowElement | null>>({});
    const { lookup: lookupBin } = useBinData();

    // Auto-scroll to highlighted field
    useEffect(() => {
        if (highlightedDe !== null && rowRefs.current[highlightedDe]) {
            rowRefs.current[highlightedDe]?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }
    }, [highlightedDe]);

    return (
        <Box>
            <Group gap={6} mb="sm">
                <IconTable size={18} />
                <Text fw={700} size="sm">Parsed Data Elements ({fields.length})</Text>
            </Group>
            <Box style={{ overflowX: 'auto' }}>
                <Table striped highlightOnHover withTableBorder withColumnBorders fz="xs">
                    <Table.Thead>
                        <Table.Tr>
                            <Table.Th w={isMobile ? 55 : 50}>DE</Table.Th>
                            <Table.Th>Field Name</Table.Th>
                            <Table.Th>Value</Table.Th>
                            {!isMobile && <Table.Th>Format</Table.Th>}
                            {!isMobile && <Table.Th>Category</Table.Th>}
                        </Table.Tr>
                    </Table.Thead>
                    <Table.Tbody>
                        {fields.map((f) => {
                            const isHighlighted = highlightedDe === f.de;
                            return (
                                <Table.Tr
                                    key={f.de}
                                    ref={(el) => { rowRefs.current[f.de] = el; }}
                                    className="field-row"
                                    onMouseEnter={() => onFieldHover(f.de)}
                                    onMouseLeave={() => onFieldHover(null)}
                                    onClick={() => onFieldClick(f.de)}
                                    style={{
                                        background: isHighlighted ? 'var(--accent-warm-subtle, rgba(193,154,138,0.12))' : undefined,
                                        cursor: 'pointer',
                                        transition: 'background 0.15s ease',
                                    }}
                                >
                                    <Table.Td style={{ whiteSpace: 'nowrap' }}>
                                        <Group gap={4} wrap="nowrap">
                                            <Badge variant="filled" color="dark" size="sm" ff="JetBrains Mono, monospace" style={{ minWidth: 28 }}>
                                                {f.de}
                                            </Badge>
                                            {isMobile && (
                                                <Box
                                                    w={6} h={6}
                                                    style={{
                                                        borderRadius: '50%',
                                                        background: CATEGORY_COLORS[f.category],
                                                        flexShrink: 0,
                                                    }}
                                                />
                                            )}
                                        </Group>
                                    </Table.Td>
                                    <Table.Td>
                                        <Text size="xs" fw={600}>{f.name}</Text>
                                        {!isMobile && f.description && (
                                            <Text size="xs" c="dimmed" mt={2}>{f.description}</Text>
                                        )}
                                    </Table.Td>
                                    <Table.Td>
                                        <Text size="xs" ff="JetBrains Mono, monospace" style={{ wordBreak: 'break-all', fontSize: isMobile ? 10 : undefined }}>
                                            {f.de === 2 ? maskPAN(enrichValue(f.de, f.decodedValue)) : enrichValue(f.de, f.decodedValue)}
                                        </Text>
                                        {f.de === 2 && (() => {
                                            const rawPan = f.decodedValue.replace(/\D/g, '');
                                            const luhnValid = validateLuhn(rawPan);
                                            const binInfo = lookupBin(rawPan);
                                            return (
                                                <Box mt={4}>
                                                    <Group gap={4} mb={4}>
                                                        <Badge
                                                            size="xs"
                                                            variant="light"
                                                            color={luhnValid ? 'green' : 'red'}
                                                            leftSection={luhnValid ? <IconCheck size={10} /> : <IconX size={10} />}
                                                        >
                                                            Luhn {luhnValid ? 'Valid' : 'Invalid'}
                                                        </Badge>
                                                    </Group>
                                                    {binInfo && (
                                                        <Box
                                                            p={6}
                                                            mt={4}
                                                            style={{
                                                                background: 'var(--surface-1, rgba(0,0,0,0.03))',
                                                                borderRadius: 6,
                                                                border: '1px solid var(--border-standard)',
                                                                fontSize: isMobile ? 9 : 11,
                                                            }}
                                                        >
                                                            <Text size="xs" fw={600} mb={2} style={{ fontSize: isMobile ? 10 : 11 }}>BIN: {rawPan.substring(0, 6)}</Text>
                                                            <Text size="xs" c="dimmed" style={{ fontSize: isMobile ? 9 : 11 }}>Brand: {binInfo.brand}</Text>
                                                            <Text size="xs" c="dimmed" style={{ fontSize: isMobile ? 9 : 11 }}>Type: {binInfo.type}</Text>
                                                            <Text size="xs" c="dimmed" style={{ fontSize: isMobile ? 9 : 11 }}>Category: {binInfo.category}</Text>
                                                            <Text size="xs" c="dimmed" style={{ fontSize: isMobile ? 9 : 11 }}>Issuer: {binInfo.issuer}</Text>
                                                            <Text size="xs" c="dimmed" style={{ fontSize: isMobile ? 9 : 11 }}>Country: {binInfo.country}</Text>
                                                        </Box>
                                                    )}
                                                </Box>
                                            );
                                        })()}
                                        <Text size="xs" c="dimmed" mt={2} ff="JetBrains Mono, monospace" style={{ fontSize: isMobile ? 9 : undefined }}>
                                            HEX: {f.rawHex}
                                        </Text>
                                        {isMobile && (
                                            <Text size="xs" c="dimmed" mt={2} ff="JetBrains Mono, monospace" style={{ fontSize: 9 }}>
                                                {f.format} ({f.type})
                                            </Text>
                                        )}
                                    </Table.Td>
                                    {!isMobile && (
                                        <Table.Td>
                                            <Text size="xs" ff="JetBrains Mono, monospace">
                                                {f.format} ({f.type})
                                            </Text>
                                        </Table.Td>
                                    )}
                                    {!isMobile && (
                                        <Table.Td>
                                            <span
                                                className="category-pill"
                                                style={{
                                                    background: `${CATEGORY_COLORS[f.category]}20`,
                                                    color: CATEGORY_COLORS[f.category],
                                                    border: `1px solid ${CATEGORY_COLORS[f.category]}40`,
                                                }}
                                            >
                                                {getCategoryLabel(f.category)}
                                            </span>
                                        </Table.Td>
                                    )}
                                </Table.Tr>
                            );
                        })}
                    </Table.Tbody>
                </Table>
            </Box>
        </Box>
    );
}

// ─── Learn Panel ──────────────────────────────────────────────────
function LearnPanel({ onSelectPreset }: { onSelectPreset: (hex: string) => void }) {
    return (
        <Box>
            <Group gap={8} mb="md">
                <IconSchool size={22} />
                <Title order={4}>Learn ISO 8583</Title>
            </Group>
            <Text size="sm" c="dimmed" mb="lg">
                Pick a real-world scenario to see how ISO 8583 works under the hood. Each scenario loads a real hex message you can explore.
            </Text>
            <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="md">
                {LEARNING_SCENARIOS.map((scenario) => {
                    const preset = PRESET_MESSAGES.find(p => p.id === scenario.presetId);
                    return (
                        <UnstyledButton
                            key={scenario.id}
                            className="scenario-card"
                            onClick={() => preset && onSelectPreset(preset.hex)}
                        >
                            <Group gap={10} mb={8}>
                                <Text size="xl">{scenario.icon}</Text>
                                <Text fw={700} size="sm">{scenario.title}</Text>
                            </Group>
                            <Text size="xs" c="dimmed" mb="sm">{scenario.description}</Text>
                            <ol className="learn-steps">
                                {scenario.steps.map((step, i) => (
                                    <li key={i} data-step={i + 1}>{step}</li>
                                ))}
                            </ol>
                            <Group gap={4} mt="sm">
                                <IconArrowRight size={14} color="var(--accent-warm)" />
                                <Text size="xs" fw={600} c="var(--accent-warm)">Load this message</Text>
                            </Group>
                        </UnstyledButton>
                    );
                })}
            </SimpleGrid>
        </Box>
    );
}

// ─── Field Reference ──────────────────────────────────────────────
function FieldReference() {
    const [searchQuery, setSearchQuery] = useState('');
    const allFields = useMemo(() =>
        Object.entries(FIELD_SPECS)
            .map(([num, spec]) => ({ de: parseInt(num), ...spec }))
            .sort((a, b) => a.de - b.de),
        []
    );

    const filteredFields = useMemo(() => {
        if (!searchQuery.trim()) return allFields;
        const q = searchQuery.toLowerCase();
        return allFields.filter(f =>
            f.de.toString().includes(q) ||
            f.name.toLowerCase().includes(q) ||
            f.format.toLowerCase().includes(q) ||
            f.type.includes(q) ||
            (f.description && f.description.toLowerCase().includes(q))
        );
    }, [searchQuery, allFields]);

    return (
        <Box>
            <Group gap={8} mb="md">
                <IconInfoCircle size={20} />
                <Title order={4}>Field Reference (ISO 8583-1987)</Title>
                <Badge size="sm" variant="light">{allFields.length} fields</Badge>
            </Group>
            <TextInput
                placeholder="Search fields... (e.g., 'PAN', 'amount', '41', 'LLVAR')"
                leftSection={<IconSearch size={14} />}
                size="xs"
                mb="md"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.currentTarget.value)}
            />
            <Box style={{ overflowX: 'auto', maxHeight: 600, overflowY: 'auto' }}>
                <Table striped highlightOnHover withTableBorder fz="xs" stickyHeader>
                    <Table.Thead>
                        <Table.Tr>
                            <Table.Th w={50}>DE</Table.Th>
                            <Table.Th>Name</Table.Th>
                            <Table.Th w={60}>Max Len</Table.Th>
                            <Table.Th w={80}>Format</Table.Th>
                            <Table.Th w={50}>Type</Table.Th>
                        </Table.Tr>
                    </Table.Thead>
                    <Table.Tbody>
                        {filteredFields.map((f) => (
                            <Tooltip key={f.de} label={f.description || f.name} withArrow multiline w={300} disabled={!f.description}>
                                <Table.Tr>
                                    <Table.Td><Badge size="xs" variant="filled" color="dark">{f.de}</Badge></Table.Td>
                                    <Table.Td><Text size="xs" fw={500}>{f.name}</Text></Table.Td>
                                    <Table.Td><Text size="xs" ff="monospace">{f.maxLength}</Text></Table.Td>
                                    <Table.Td><Badge size="xs" variant="light">{f.format}</Badge></Table.Td>
                                    <Table.Td><Text size="xs" ff="monospace">{f.type}</Text></Table.Td>
                                </Table.Tr>
                            </Tooltip>
                        ))}
                    </Table.Tbody>
                </Table>
            </Box>
            {searchQuery && (
                <Text size="xs" c="dimmed" mt="xs">
                    {filteredFields.length} of {allFields.length} fields match
                </Text>
            )}
        </Box>
    );
}

// ─── Response Code Reference ──────────────────────────────────────
function ResponseCodeReference() {
    const [searchQuery, setSearchQuery] = useState('');

    const allCodes = useMemo(() =>
        Object.entries(RESPONSE_CODES).map(([code, info]) => ({ code, ...info })),
        []
    );

    const filteredCodes = useMemo(() => {
        if (!searchQuery.trim()) return allCodes;
        const q = searchQuery.toLowerCase();
        return allCodes.filter(c =>
            c.code.includes(q) ||
            c.text.toLowerCase().includes(q) ||
            c.severity.includes(q)
        );
    }, [searchQuery, allCodes]);

    return (
        <Box>
            <Group gap={8} mb="md">
                <IconInfoCircle size={20} />
                <Title order={4}>Response Code Reference</Title>
                <Badge size="sm" variant="light">{allCodes.length} codes</Badge>
            </Group>
            <TextInput
                placeholder="Search codes... (e.g., 'insufficient', '51', 'success')"
                leftSection={<IconSearch size={14} />}
                size="xs"
                mb="md"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.currentTarget.value)}
            />
            <Box style={{ overflowX: 'auto', maxHeight: 400, overflowY: 'auto' }}>
                <Table striped highlightOnHover withTableBorder fz="xs" stickyHeader>
                    <Table.Thead>
                        <Table.Tr>
                            <Table.Th w={60}>Code</Table.Th>
                            <Table.Th>Description</Table.Th>
                            <Table.Th w={80}>Result</Table.Th>
                        </Table.Tr>
                    </Table.Thead>
                    <Table.Tbody>
                        {filteredCodes.map(({ code, text, severity }) => (
                            <Table.Tr key={code}>
                                <Table.Td>
                                    <Badge ff="monospace" variant="filled" color="dark" size="sm">{code}</Badge>
                                </Table.Td>
                                <Table.Td><Text size="xs">{text}</Text></Table.Td>
                                <Table.Td>
                                    <Badge
                                        size="xs"
                                        color={severity === 'success' ? 'green' : severity === 'warning' ? 'yellow' : 'red'}
                                    >
                                        {severity === 'success' ? '✓ OK' : severity === 'warning' ? '⚠ WARN' : '✗ FAIL'}
                                    </Badge>
                                </Table.Td>
                            </Table.Tr>
                        ))}
                    </Table.Tbody>
                </Table>
            </Box>
            {searchQuery && (
                <Text size="xs" c="dimmed" mt="xs">
                    {filteredCodes.length} of {allCodes.length} codes match
                </Text>
            )}
        </Box>
    );
}

// ─── What Is Section ──────────────────────────────────────────────
function WhatIsSection() {
    return (
        <Accordion variant="separated" radius="md" mb="xl">
            <Accordion.Item value="what-is">
                <Accordion.Control>
                    <Group gap={8}>
                        <IconSchool size={18} />
                        <Text fw={700} size="sm">New to ISO 8583? Start here</Text>
                    </Group>
                </Accordion.Control>
                <Accordion.Panel>
                    <Stack gap="md">
                        <Box>
                            <Text fw={700} size="sm" mb={4}>What is ISO 8583?</Text>
                            <Text size="sm" c="dimmed">
                                ISO 8583 is the binary protocol behind <strong>every card swipe</strong>, tap, and online purchase. When you tap your card for coffee, the POS terminal doesn't send a JSON object — it sends a compact binary message that's 50x smaller than JSON and processes in under 200ms.
                            </Text>
                        </Box>
                        <Divider />
                        <Box>
                            <Text fw={700} size="sm" mb={4}>How is a message structured?</Text>
                            <SimpleGrid cols={{ base: 1, sm: 3 }} spacing="sm">
                                <Paper p="sm" radius="md" withBorder>
                                    <Badge color="violet" mb={4}>Part 1</Badge>
                                    <Text fw={700} size="sm">MTI</Text>
                                    <Text size="xs" c="dimmed">4-digit code telling you: What version? What type? Request or Response? Who sent it?</Text>
                                </Paper>
                                <Paper p="sm" radius="md" withBorder>
                                    <Badge color="blue" mb={4}>Part 2</Badge>
                                    <Text fw={700} size="sm">Bitmap</Text>
                                    <Text size="xs" c="dimmed">64-bit "switchboard" — each bit says whether a data field is present (1) or absent (0).</Text>
                                </Paper>
                                <Paper p="sm" radius="md" withBorder>
                                    <Badge color="green" mb={4}>Part 3</Badge>
                                    <Text fw={700} size="sm">Data Elements</Text>
                                    <Text size="xs" c="dimmed">The actual payload: card number, amount, currency, terminal info, response codes, etc.</Text>
                                </Paper>
                            </SimpleGrid>
                        </Box>
                        <Divider />
                        <Box>
                            <Text fw={700} size="sm" mb={4}>What's LLVAR / LLLVAR?</Text>
                            <Text size="sm" c="dimmed">
                                Think of it like a "polite conversation": <strong>"I'm about to say 16 numbers. Here they are: 4111111111111111."</strong> The first 2 digits (LL) or 3 digits (LLL) tell the parser how many bytes to read next. This is what makes ISO 8583 so space-efficient — no field separators, no key names, just length + data.
                            </Text>
                        </Box>
                    </Stack>
                </Accordion.Panel>
            </Accordion.Item>
        </Accordion>
    );
}

// ─── Main App ─────────────────────────────────────────────────────
export default function App() {
    const [hexInput, setHexInput] = useState('');
    const [debouncedHex] = useDebouncedValue(hexInput, 300);
    const [activeTab, setActiveTab] = useState<string | null>('parse');
    const [highlightedDe, setHighlightedDe] = useState<number | null>(null);
    const [shareTooltip, setShareTooltip] = useState(false);

    // Load hex from URL hash on mount
    useEffect(() => {
        const hashHex = decodeHexFromHash();
        if (hashHex) {
            setHexInput(hashHex);
        }
    }, []);

    // Update URL hash when hex changes
    useEffect(() => {
        const cleaned = debouncedHex.replace(/[\s\n\r]/g, '');
        if (cleaned) {
            window.history.replaceState(null, '', encodeHexToHash(cleaned));
        } else {
            window.history.replaceState(null, '', window.location.pathname);
        }
    }, [debouncedHex]);

    const result = useMemo<ParseResult | null>(() => {
        const cleaned = debouncedHex.replace(/[\s\n\r]/g, '');
        if (!cleaned) return null;
        return parseISO8583(cleaned);
    }, [debouncedHex]);

    const handlePresetSelect = useCallback((value: string | null) => {
        if (!value) return;
        const preset = PRESET_MESSAGES.find(p => p.id === value);
        if (preset) {
            setHexInput(preset.hex);
            setActiveTab('parse');
        }
    }, []);

    const handleScenarioLoad = useCallback((hex: string) => {
        setHexInput(hex);
        setActiveTab('parse');
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }, []);

    const handleShareClick = useCallback(() => {
        const cleaned = hexInput.replace(/[\s\n\r]/g, '');
        if (!cleaned) return;
        const url = window.location.origin + window.location.pathname + encodeHexToHash(cleaned);
        navigator.clipboard.writeText(url);
        setShareTooltip(true);
        setTimeout(() => setShareTooltip(false), 2000);
    }, [hexInput]);

    const handleFieldClick = useCallback((de: number) => {
        setHighlightedDe(prev => prev === de ? null : de);
    }, []);

    const handleFieldHover = useCallback((de: number | null) => {
        if (de !== null) setHighlightedDe(de);
        else setHighlightedDe(null);
    }, []);

    const getMTIIcon = (mti: string) => {
        if (mti.startsWith('01')) return <IconCreditCard size={16} />;
        if (mti.startsWith('02')) return <IconShieldCheck size={16} />;
        if (mti.startsWith('04')) return <IconRefresh size={16} />;
        if (mti.startsWith('08')) return <IconWifi size={16} />;
        return <IconCreditCard size={16} />;
    };

    return (
        <Box pb="xl">
            {/* Hero */}
            <div className="hero-section">
                <Title order={1}>
                    ISO 8583 <span>Parser</span> Playground
                </Title>
                <p className="hero-subtitle">
                    Paste raw hex → see the parsed message instantly. Decode MTIs, visualize bitmaps,
                    and explore every data element. Built for payment engineers, curious developers, and anyone learning card transaction protocols.
                </p>
            </div>

            <Container size="xl" px={{ base: 'sm', md: 'md' }}>
                {/* Beginner-friendly intro */}
                <WhatIsSection />

                {/* Input Section */}
                <Paper className="brut-card" p="lg" mb="xl">
                    <Group justify="space-between" mb="md" wrap="wrap" gap="sm">
                        <Group gap={8}>
                            <IconCode size={20} />
                            <Text fw={700}>Hex Input</Text>
                            {result?.mti && (
                                <Badge
                                    leftSection={getMTIIcon(result.mti.raw)}
                                    color={result.success ? 'teal' : 'red'}
                                    variant="light"
                                    size="lg"
                                >
                                    {result.mti.raw} — {result.mti.messageClass.label}
                                </Badge>
                            )}
                        </Group>
                        <Group gap="sm">
                            <Select
                                placeholder="Load example..."
                                data={PRESET_MESSAGES.map(p => ({
                                    value: p.id,
                                    label: p.name,
                                }))}
                                onChange={handlePresetSelect}
                                size="xs"
                                w={{ base: '100%', sm: 260 }}
                                clearable
                            />
                            {hexInput && (
                                <>
                                    <CopyButton value={hexInput}>
                                        {({ copied, copy }) => (
                                            <Tooltip label={copied ? 'Copied!' : 'Copy hex'} withArrow>
                                                <ActionIcon variant="light" color={copied ? 'teal' : 'gray'} onClick={copy} size="md">
                                                    {copied ? <IconCheck size={16} /> : <IconCopy size={16} />}
                                                </ActionIcon>
                                            </Tooltip>
                                        )}
                                    </CopyButton>
                                    {result && (
                                        <>
                                            <Tooltip label="Download as JSON" withArrow>
                                                <ActionIcon variant="light" color="gray" size="md" onClick={() => {
                                                    const json = resultToJSON(result);
                                                    const blob = new Blob([json], { type: 'application/json' });
                                                    const url = URL.createObjectURL(blob);
                                                    const a = document.createElement('a');
                                                    a.href = url;
                                                    a.download = `iso8583_${result.mti?.raw || 'message'}.json`;
                                                    a.click();
                                                    URL.revokeObjectURL(url);
                                                }}>
                                                    <IconDownload size={16} />
                                                </ActionIcon>
                                            </Tooltip>
                                            <CopyButton value={resultToText(result)}>
                                                {({ copied, copy }) => (
                                                    <Tooltip label={copied ? 'Text Copied!' : 'Copy as Text'} withArrow>
                                                        <ActionIcon variant="light" color={copied ? 'teal' : 'gray'} onClick={copy} size="md">
                                                            {copied ? <IconCheck size={16} /> : <IconFileText size={16} />}
                                                        </ActionIcon>
                                                    </Tooltip>
                                                )}
                                            </CopyButton>
                                        </>
                                    )}
                                    <Tooltip label={shareTooltip ? 'Link copied!' : 'Copy share link'} withArrow opened={shareTooltip || undefined}>
                                        <ActionIcon variant="light" color={shareTooltip ? 'teal' : 'gray'} onClick={handleShareClick} size="md">
                                            {shareTooltip ? <IconCheck size={16} /> : <IconShare size={16} />}
                                        </ActionIcon>
                                    </Tooltip>
                                    <ActionIcon variant="light" color="red" onClick={() => setHexInput('')} size="md">
                                        <IconX size={16} />
                                    </ActionIcon>
                                </>
                            )}
                        </Group>
                    </Group>

                    {/* Show preset scenario description */}
                    {hexInput && (
                        <Box mb="sm">
                            {PRESET_MESSAGES.filter(p => p.hex === hexInput).map(p => (
                                <Alert key={p.id} color="blue" variant="light" radius="md" mb="sm" icon={<IconInfoCircle size={18} />}>
                                    <Text fw={700} size="sm">{p.scenario}</Text>
                                </Alert>
                            ))}
                        </Box>
                    )}

                    <div className="hex-input-wrapper">
                        <Textarea
                            placeholder="Paste ISO 8583 hex string here... (e.g., 0100F23C46D128E080...)"
                            value={hexInput}
                            onChange={(e) => setHexInput(e.currentTarget.value)}
                            minRows={4}
                            maxRows={10}
                            autosize
                            styles={{
                                input: {
                                    fontFamily: 'JetBrains Mono, monospace',
                                    fontSize: 14,
                                },
                            }}
                        />
                    </div>

                    {hexInput && (
                        <Group mt="xs" gap="xs">
                            <Text size="xs" c="dimmed">
                                {hexInput.replace(/[\s\n\r]/g, '').length} hex characters
                                ({Math.ceil(hexInput.replace(/[\s\n\r]/g, '').length / 2)} bytes)
                            </Text>
                            {result?.fields && (
                                <Text size="xs" c="dimmed">
                                    • {result.fields.length} fields parsed
                                </Text>
                            )}
                            {result?.mti && (
                                <Badge size="xs" variant="light" color="gray" leftSection={<IconLink size={10} />}>
                                    Shareable URL updated
                                </Badge>
                            )}
                        </Group>
                    )}

                    {/* Errors */}
                    {result?.errors && result.errors.length > 0 && (
                        <Stack gap="xs" mt="md">
                            {result.errors.map((err, i) => (
                                <Alert
                                    key={i}
                                    color={err.message.includes('No spec') || err.message.includes('unparsed') ? 'yellow' : 'red'}
                                    variant="light"
                                    radius="md"
                                    icon={<IconAlertTriangle size={16} />}
                                >
                                    <Text size="xs">{err.message}</Text>
                                </Alert>
                            ))}
                        </Stack>
                    )}
                </Paper>

                {/* Main Content Tabs */}
                <Tabs value={activeTab} onChange={setActiveTab}>
                    <Tabs.List mb="lg">
                        <Tabs.Tab value="parse" leftSection={<IconCreditCard size={16} />}>
                            Parse Results
                        </Tabs.Tab>
                        <Tabs.Tab value="learn" leftSection={<IconSchool size={16} />}>
                            Learn
                        </Tabs.Tab>
                        <Tabs.Tab value="reference" leftSection={<IconTable size={16} />}>
                            Field Reference
                        </Tabs.Tab>
                    </Tabs.List>

                    {/* Parse Results Tab */}
                    <Tabs.Panel value="parse">
                        {!result ? (
                            <Paper p="xl" ta="center" radius="md" withBorder>
                                <Text size="xl" mb="xs">👆</Text>
                                <Text fw={600} size="sm">Paste a hex string above or pick an example to get started</Text>
                                <Text size="xs" c="dimmed" mt={4}>The parser will decode it in real-time</Text>
                            </Paper>
                        ) : (
                            <div className="fade-in">
                                <div className="main-grid">
                                    {/* MTI Decoder */}
                                    {result.mti && (
                                        <Paper className="brut-card" p="lg">
                                            <MTIDecoder mti={result.mti} />
                                        </Paper>
                                    )}

                                    {/* Hex Annotator */}
                                    {result.hexSegments.length > 0 && (
                                        <Paper className="brut-card" p="lg">
                                            <HexAnnotator
                                                segments={result.hexSegments}
                                                highlightedDe={highlightedDe}
                                                onFieldHover={handleFieldHover}
                                            />
                                        </Paper>
                                    )}

                                    {/* Primary Bitmap */}
                                    {result.primaryBitmap && (
                                        <Paper className="brut-card" p="lg">
                                            <BitmapVisualizer
                                                bitmap={result.primaryBitmap}
                                                offset={0}
                                                highlightedDe={highlightedDe}
                                                onFieldClick={handleFieldClick}
                                            />
                                        </Paper>
                                    )}

                                    {/* Secondary Bitmap */}
                                    {result.secondaryBitmap && (
                                        <Paper className="brut-card" p="lg">
                                            <BitmapVisualizer
                                                bitmap={result.secondaryBitmap}
                                                offset={64}
                                                highlightedDe={highlightedDe}
                                                onFieldClick={handleFieldClick}
                                            />
                                        </Paper>
                                    )}

                                    {/* Message Statistics */}
                                    {result.fields.length > 0 && (
                                        <MessageStats result={result} />
                                    )}

                                    {/* Field Breakdown Table */}
                                    {result.fields.length > 0 && (
                                        <Paper className="brut-card full-width" p="lg">
                                            <FieldTable
                                                fields={result.fields}
                                                highlightedDe={highlightedDe}
                                                onFieldHover={handleFieldHover}
                                                onFieldClick={handleFieldClick}
                                            />
                                        </Paper>
                                    )}
                                </div>
                            </div>
                        )}
                    </Tabs.Panel>

                    {/* Learn Tab */}
                    <Tabs.Panel value="learn">
                        <LearnPanel onSelectPreset={handleScenarioLoad} />
                    </Tabs.Panel>

                    {/* Reference Tab */}
                    <Tabs.Panel value="reference">
                        <Paper className="brut-card" p="lg">
                            <FieldReference />
                        </Paper>
                        <Paper className="brut-card" p="lg" mt="lg">
                            <ResponseCodeReference />
                        </Paper>
                    </Tabs.Panel>
                </Tabs>
            </Container>

            {/* Footer */}
            <footer className="app-footer">
                <Text size="sm" fw={600} mb={4}>ISO 8583 Parser Playground</Text>
                <Text size="xs" c="dimmed">
                    Built by <a href="https://linkedin.com/in/sivasub987" target="_blank" rel="noopener">Siva</a> • Product Owner at the intersection of Payments & AI
                </Text>
                <Text size="xs" c="dimmed" mt={4}>
                    Pairs with the ISO 8583 Carousel & PDF Cheat Sheet on LinkedIn
                </Text>
            </footer>
        </Box>
    );
}
