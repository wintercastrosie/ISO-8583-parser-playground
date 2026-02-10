// ISO 8583 Parser Engine
import { FIELD_SPECS, MTI_VERSION, MTI_CLASS, MTI_FUNCTION, MTI_ORIGIN, MTI_DESCRIPTIONS } from './fieldSpecs';

export interface MTIInfo {
    raw: string;
    version: { code: string; label: string };
    messageClass: { code: string; label: string };
    function: { code: string; label: string };
    origin: { code: string; label: string };
    description: string;
}

export interface ParsedField {
    de: number;
    name: string;
    rawHex: string;
    decodedValue: string;
    length: number;
    format: string;
    type: string;
    category: string;
    startPos: number; // hex string position
    endPos: number;   // hex string position
    description?: string;
}

export interface BitmapInfo {
    rawHex: string;
    binary: string;
    activeFields: number[];
    hasSecondary: boolean;
    startPos: number;
    endPos: number;
}

export interface ParseResult {
    success: boolean;
    mti: MTIInfo | null;
    primaryBitmap: BitmapInfo | null;
    secondaryBitmap: BitmapInfo | null;
    fields: ParsedField[];
    errors: ParseError[];
    hexSegments: HexSegment[];
}

export interface ParseError {
    message: string;
    position?: number;
    field?: number;
}

export interface HexSegment {
    hex: string;
    label: string;
    category: string;
    startPos: number;
    endPos: number;
    de?: number;
}

// Utility: hex string to binary string
function hexToBinary(hex: string): string {
    return hex.split('').map(h => parseInt(h, 16).toString(2).padStart(4, '0')).join('');
}

// Utility: hex to ASCII
function hexToAscii(hex: string): string {
    let ascii = '';
    for (let i = 0; i < hex.length; i += 2) {
        const code = parseInt(hex.substring(i, i + 2), 16);
        if (code >= 32 && code <= 126) {
            ascii += String.fromCharCode(code);
        } else {
            ascii += '.';
        }
    }
    return ascii;
}

// Decode MTI
export function decodeMTI(mtiHex: string): MTIInfo {
    // MTI can be 4 hex chars (2 bytes BCD) or 4 ASCII chars (4 bytes)
    let mtiStr = mtiHex;

    // If it looks like ASCII hex encoding (8 chars for 4 digits)
    if (mtiHex.length >= 8) {
        const ascii = hexToAscii(mtiHex.substring(0, 8));
        if (/^\d{4}$/.test(ascii)) {
            mtiStr = ascii;
        }
    }

    // If it's 4 hex chars that represent BCD
    if (mtiStr.length === 4 && /^[0-9]{4}$/.test(mtiStr)) {
        // Already good
    } else if (mtiStr.length >= 4) {
        mtiStr = mtiStr.substring(0, 4);
    }

    const digits = mtiStr.split('');

    return {
        raw: mtiStr,
        version: { code: digits[0], label: MTI_VERSION[digits[0]] || 'Unknown' },
        messageClass: { code: digits[1], label: MTI_CLASS[digits[1]] || 'Unknown' },
        function: { code: digits[2], label: MTI_FUNCTION[digits[2]] || 'Unknown' },
        origin: { code: digits[3], label: MTI_ORIGIN[digits[3]] || 'Unknown' },
        description: MTI_DESCRIPTIONS[mtiStr] || `Message Type ${mtiStr}`,
    };
}

// Decode Bitmap
export function decodeBitmap(hexStr: string): { activeFields: number[]; binary: string } {
    const binary = hexToBinary(hexStr);
    const activeFields: number[] = [];

    for (let i = 0; i < binary.length; i++) {
        if (binary[i] === '1') {
            activeFields.push(i + 1);
        }
    }

    return { activeFields, binary };
}

// Main Parse Function
export function parseISO8583(inputHex: string): ParseResult {
    const errors: ParseError[] = [];
    const fields: ParsedField[] = [];
    const hexSegments: HexSegment[] = [];

    // Normalize: remove spaces, newlines, make uppercase
    const hex = inputHex.replace(/[\s\n\r]/g, '').toUpperCase();

    if (!hex || hex.length < 4) {
        return {
            success: false,
            mti: null,
            primaryBitmap: null,
            secondaryBitmap: null,
            fields: [],
            errors: [{ message: 'Input too short. Minimum 4 characters for MTI.' }],
            hexSegments: [],
        };
    }

    // Validate hex
    if (!/^[0-9A-F]+$/i.test(hex)) {
        return {
            success: false,
            mti: null,
            primaryBitmap: null,
            secondaryBitmap: null,
            fields: [],
            errors: [{ message: 'Invalid characters detected. Only hex characters (0-9, A-F) are allowed.' }],
            hexSegments: [],
        };
    }

    let pos = 0;

    // 1. Parse MTI (4 hex chars = 2 bytes BCD encoded)
    const mtiHex = hex.substring(pos, pos + 4);
    const mti = decodeMTI(mtiHex);
    hexSegments.push({
        hex: mtiHex,
        label: `MTI: ${mti.raw}`,
        category: 'mti',
        startPos: pos,
        endPos: pos + 4,
    });
    pos += 4;

    if (pos + 16 > hex.length) {
        return {
            success: true,
            mti,
            primaryBitmap: null,
            secondaryBitmap: null,
            fields,
            errors: [{ message: 'Hex too short for primary bitmap (need 16 more hex chars / 8 bytes).', position: pos }],
            hexSegments,
        };
    }

    // 2. Parse Primary Bitmap (16 hex chars = 8 bytes = 64 bits)
    const primaryBitmapHex = hex.substring(pos, pos + 16);
    const primaryDecoded = decodeBitmap(primaryBitmapHex);
    const primaryBitmap: BitmapInfo = {
        rawHex: primaryBitmapHex,
        binary: primaryDecoded.binary,
        activeFields: primaryDecoded.activeFields.filter(f => f >= 2 && f <= 64),
        hasSecondary: primaryDecoded.binary[0] === '1',
        startPos: pos,
        endPos: pos + 16,
    };
    hexSegments.push({
        hex: primaryBitmapHex,
        label: 'Primary Bitmap',
        category: 'bitmap',
        startPos: pos,
        endPos: pos + 16,
    });
    pos += 16;

    // 3. Parse Secondary Bitmap if bit 1 is set
    let secondaryBitmap: BitmapInfo | null = null;
    let allActiveFields = [...primaryBitmap.activeFields];

    if (primaryBitmap.hasSecondary) {
        if (pos + 16 > hex.length) {
            errors.push({ message: 'Bit 1 indicates secondary bitmap but hex is too short.', position: pos });
        } else {
            const secondaryBitmapHex = hex.substring(pos, pos + 16);
            const secondaryDecoded = decodeBitmap(secondaryBitmapHex);
            secondaryBitmap = {
                rawHex: secondaryBitmapHex,
                binary: secondaryDecoded.binary,
                activeFields: secondaryDecoded.activeFields.map(f => f + 64),
                hasSecondary: false,
                startPos: pos,
                endPos: pos + 16,
            };
            hexSegments.push({
                hex: secondaryBitmapHex,
                label: 'Secondary Bitmap',
                category: 'bitmap',
                startPos: pos,
                endPos: pos + 16,
            });
            allActiveFields = [...allActiveFields, ...secondaryBitmap.activeFields];
            pos += 16;
        }
    }

    // 4. Parse Data Elements
    for (const fieldNum of allActiveFields) {
        const spec = FIELD_SPECS[fieldNum];

        if (!spec) {
            // Unknown field - skip with warning
            errors.push({ message: `No spec for DE ${fieldNum}. Skipping.`, field: fieldNum });
            continue;
        }

        if (pos >= hex.length) {
            errors.push({ message: `Ran out of data at DE ${fieldNum}.`, position: pos, field: fieldNum });
            break;
        }

        const fieldStartPos = pos;
        let fieldHex = '';
        let fieldValue = '';
        let fieldLength = 0;

        try {
            if (spec.format === 'FIXED') {
                // Fixed length: read exactly maxLength chars (for numeric) or maxLength*2 hex chars
                let hexLen: number;
                if (spec.type === 'b') {
                    hexLen = spec.maxLength * 2; // Binary: maxLength is in bytes
                } else if (spec.type === 'n' || spec.type === 'x+n') {
                    // Numeric: BCD packed = ceil(maxLength/2) bytes = maxLength hex chars
                    hexLen = spec.maxLength;
                    // Handle odd lengths
                    if (spec.maxLength % 2 !== 0) {
                        hexLen = spec.maxLength + 1; // Pad to even for BCD
                    }
                } else {
                    // AN/ANS/Z: 1 byte per char
                    hexLen = spec.maxLength * 2;
                }

                if (pos + hexLen > hex.length) {
                    errors.push({ message: `DE ${fieldNum}: Expected ${hexLen} hex chars but only ${hex.length - pos} remain.`, position: pos, field: fieldNum });
                    fieldHex = hex.substring(pos);
                    pos = hex.length;
                } else {
                    fieldHex = hex.substring(pos, pos + hexLen);
                    pos += hexLen;
                }
                fieldLength = hexLen / 2;

                // Decode value
                if (spec.type === 'n' || spec.type === 'x+n') {
                    fieldValue = fieldHex; // Numeric stays as-is
                } else if (spec.type === 'b') {
                    fieldValue = fieldHex; // Binary stays hex
                } else {
                    fieldValue = hexToAscii(fieldHex); // an, ans, z
                }

            } else if (spec.format === 'LLVAR') {
                // Read 2-char length prefix (BCD)
                if (pos + 2 > hex.length) {
                    errors.push({ message: `DE ${fieldNum}: Not enough data for LLVAR length prefix.`, position: pos, field: fieldNum });
                    break;
                }
                const lenStr = hex.substring(pos, pos + 2);
                const dataLen = parseInt(lenStr, 10);
                pos += 2;

                if (isNaN(dataLen) || dataLen < 0 || dataLen > spec.maxLength) {
                    errors.push({ message: `DE ${fieldNum}: Invalid LLVAR length ${lenStr} (max ${spec.maxLength}).`, position: pos - 2, field: fieldNum });
                    continue;
                }

                // For numeric types, BCD packing; for an/ans/z, 1 byte per char
                let hexLen: number;
                if (spec.type === 'n') {
                    hexLen = dataLen % 2 === 0 ? dataLen : dataLen + 1;
                } else {
                    hexLen = dataLen * 2; // an, ans, z: 1 byte per char
                }

                if (pos + hexLen > hex.length) {
                    errors.push({ message: `DE ${fieldNum}: Expected ${hexLen} hex chars for data but only ${hex.length - pos} remain.`, position: pos, field: fieldNum });
                    fieldHex = lenStr + hex.substring(pos);
                    pos = hex.length;
                } else {
                    fieldHex = lenStr + hex.substring(pos, pos + hexLen);
                    pos += hexLen;
                }
                fieldLength = dataLen;

                if (spec.type === 'n') {
                    fieldValue = hex.substring(pos - hexLen, pos);
                } else {
                    fieldValue = hexToAscii(hex.substring(pos - hexLen, pos));
                }

            } else if (spec.format === 'LLLVAR') {
                // LLLVAR: 2 bytes (4 hex chars) for the length prefix (BCD packed 3-digit length)
                if (pos + 4 > hex.length) {
                    errors.push({ message: `DE ${fieldNum}: Not enough data for LLLVAR length prefix (need 4 hex chars).`, position: pos, field: fieldNum });
                    break;
                }
                const lenStr = hex.substring(pos, pos + 4);
                const dataLen = parseInt(lenStr, 10);
                pos += 4;

                if (isNaN(dataLen) || dataLen < 0 || dataLen > spec.maxLength) {
                    errors.push({ message: `DE ${fieldNum}: Invalid LLLVAR length ${lenStr}.`, position: pos - 4, field: fieldNum });
                    continue;
                }

                let hexLen: number;
                if (spec.type === 'n') {
                    hexLen = dataLen % 2 === 0 ? dataLen : dataLen + 1;
                } else {
                    hexLen = dataLen * 2; // an, ans, z: 1 byte per char
                }

                if (pos + hexLen > hex.length) {
                    errors.push({ message: `DE ${fieldNum}: Expected ${hexLen} hex chars for data but only ${hex.length - pos} remain.`, position: pos, field: fieldNum });
                    fieldHex = lenStr + hex.substring(pos);
                    pos = hex.length;
                } else {
                    fieldHex = lenStr + hex.substring(pos, pos + hexLen);
                    pos += hexLen;
                }
                fieldLength = dataLen;

                if (spec.type === 'n') {
                    fieldValue = hex.substring(pos - hexLen, pos);
                } else {
                    fieldValue = hexToAscii(hex.substring(pos - hexLen, pos));
                }
            }
        } catch (e) {
            errors.push({ message: `DE ${fieldNum}: Parse error - ${(e as Error).message}`, position: pos, field: fieldNum });
            continue;
        }

        fields.push({
            de: fieldNum,
            name: spec.name,
            rawHex: fieldHex,
            decodedValue: fieldValue,
            length: fieldLength,
            format: spec.format,
            type: spec.type,
            category: spec.category,
            startPos: fieldStartPos,
            endPos: pos,
            description: spec.description,
        });

        hexSegments.push({
            hex: fieldHex,
            label: `DE ${fieldNum}: ${spec.name}`,
            category: spec.category,
            startPos: fieldStartPos,
            endPos: pos,
            de: fieldNum,
        });
    }

    // Check for remaining unparsed data
    if (pos < hex.length) {
        const remaining = hex.substring(pos);
        errors.push({ message: `${remaining.length} unparsed hex characters remaining after field parsing.`, position: pos });
        hexSegments.push({
            hex: remaining,
            label: 'Unparsed Data',
            category: 'error',
            startPos: pos,
            endPos: hex.length,
        });
    }

    return {
        success: errors.filter(e => !e.message.includes('No spec') && !e.message.includes('unparsed')).length === 0,
        mti,
        primaryBitmap,
        secondaryBitmap,
        fields,
        errors,
        hexSegments,
    };
}
