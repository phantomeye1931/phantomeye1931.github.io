export interface Button {
    alignRight: boolean,
    label: string,
    url?: string
    behavior?: string,
}

export enum BackgroundVariant {
    Fill = 'fill',
    Gradient = 'gradient',
    MobileGradient = 'mobile-gradient',
}

export type Prettify<T> = {
    [K in keyof T]: T[K];
} & {};