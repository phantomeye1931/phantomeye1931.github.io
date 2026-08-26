export enum Theme {
    DARK = 'dark',
    LIGHT = 'light',
}

const changeListeners = new Set<VoidFunction>();

export function onThemeChange(func: VoidFunction) {
    changeListeners.add(func);
}

function getDeviceTheme(): Theme {
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? Theme.DARK : Theme.LIGHT;
}

function setThemeOverride(theme: Theme | null) {
    if (theme == null) {
        localStorage.removeItem("theme-override");
    } else {
        localStorage.setItem("theme-override", theme);
    }
}

function getThemeOverride() {
    return localStorage.getItem("theme-override") as Theme | null
}

export function getDisplayedTheme(): Theme {
    return getThemeOverride() ?? getDeviceTheme();
}

export function cycleColorSchemes() {
    const displayTheme = getDisplayedTheme();
    const deviceTheme = getDeviceTheme();

    switch (displayTheme) {
        case Theme.DARK: { // Switch to light mode
            if (deviceTheme == Theme.LIGHT) setThemeOverride(null);
            if (deviceTheme == Theme.DARK)  setThemeOverride(Theme.LIGHT);
            break;
        }
        case Theme.LIGHT: { // Switch to dark mode
            if (deviceTheme == Theme.DARK)  setThemeOverride(null);
            if (deviceTheme == Theme.LIGHT) setThemeOverride(Theme.DARK);
            break;
        }
    }

    loadTheme();

    changeListeners.forEach(f => f());
}

loadTheme();

// Initial color scheme
function loadTheme() {
    applyColorScheme(getDisplayedTheme());
}

function applyColorScheme(theme: Theme) {
    document.documentElement.setAttribute("color-scheme", theme);
}

document.addEventListener('astro:after-swap', () => {
    loadTheme();
});