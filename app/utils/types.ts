export interface AsciiUIElement {
    alignRight: boolean,
    label: string,
    url: string,
    onClick?: (e: Event) => void,
}