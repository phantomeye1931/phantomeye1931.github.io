export function padZero(num: number, length: number): string {
    return String(num).padStart(length, '0');
}