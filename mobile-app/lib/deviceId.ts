/**
 * deviceId — Generates and persists a unique device fingerprint.
 *
 * Uses AsyncStorage (native) or localStorage (web) to persist a random UUID
 * across app restarts. This ID is sent to the backend on login/signup to
 * populate the device_links table for multi-account detection.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import * as Crypto from 'expo-crypto';

const DEVICE_ID_KEY = '@subko_device_id';

async function generateUUID(): Promise<string> {
    const bytes = await Crypto.getRandomBytesAsync(16);
    const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
    // Format as UUID v4
    return [
        hex.slice(0, 8),
        hex.slice(8, 12),
        '4' + hex.slice(13, 16),
        ((parseInt(hex[16], 16) & 0x3) | 0x8).toString(16) + hex.slice(17, 20),
        hex.slice(20, 32),
    ].join('-');
}

export async function getDeviceId(): Promise<string> {
    try {
        if (Platform.OS === 'web') {
            if (typeof localStorage !== 'undefined') {
                let id = localStorage.getItem(DEVICE_ID_KEY);
                if (!id) {
                    id = await generateUUID();
                    localStorage.setItem(DEVICE_ID_KEY, id);
                }
                return id;
            }
            return await generateUUID();
        }

        // Native (iOS/Android)
        let id = await AsyncStorage.getItem(DEVICE_ID_KEY);
        if (!id) {
            id = await generateUUID();
            await AsyncStorage.setItem(DEVICE_ID_KEY, id);
        }
        return id;
    } catch {
        // Fallback — generate a non-persisted ID
        return generateUUID();
    }
}
