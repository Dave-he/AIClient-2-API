export function formatExpiryTime(expiryTimestamp) {
    if (!expiryTimestamp || typeof expiryTimestamp !== 'number') return "No expiry date available";
    const diffMs = expiryTimestamp - Date.now();
    if (diffMs <= 0) return "Token has expired";
    let totalSeconds = Math.floor(diffMs / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    totalSeconds %= 3600;
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    const pad = (num) => String(num).padStart(2, '0');
    return `${pad(hours)}h ${pad(minutes)}m ${pad(seconds)}s`;
}

export function formatLog(tag, message, data = null) {
    let logMessage = `[${tag}] ${message}`;
    
    if (data !== null && data !== undefined) {
        if (typeof data === 'object') {
            const dataStr = Object.entries(data)
                .map(([key, value]) => `${key}: ${value}`)
                .join(', ');
            logMessage += ` | ${dataStr}`;
        } else {
            logMessage += ` | ${data}`;
        }
    }
    
    return logMessage;
}

export function formatExpiryLog(tag, expiryDate, nearMinutes) {
    const currentTime = Date.now();
    const nearMinutesInMillis = nearMinutes * 60 * 1000;
    const thresholdTime = currentTime + nearMinutesInMillis;
    const isNearExpiry = expiryDate <= thresholdTime;
    
    const message = formatLog(tag, 'Checking expiry date', {
        'Expiry date': expiryDate,
        'Current time': currentTime,
        [`${nearMinutes} minutes from now`]: thresholdTime,
        'Is near expiry': isNearExpiry
    });
    
    return { message, isNearExpiry };
}