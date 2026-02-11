export interface Theme {
  colors: {
    primary: string;
    primaryHover: string;
    secondary: string;
    secondaryHover: string;
    background: string;
    surface: string;
    text: string;
    textSecondary: string;
    border: string;
    error: string;
    success: string;
  };
  fonts: {
    family: string;
    sizes: {
      sm: string;
      md: string;
      lg: string;
      xl: string;
    };
  };
  spacing: {
    xs: string;
    sm: string;
    md: string;
    lg: string;
    xl: string;
  };
  borderRadius: {
    sm: string;
    md: string;
    lg: string;
    full: string;
  };
}

export const lightTheme: Theme = {
  colors: {
    primary: '#2563eb',
    primaryHover: '#1d4ed8',
    secondary: '#6b7280',
    secondaryHover: '#4b5563',
    background: '#ffffff',
    surface: '#f9fafb',
    text: '#111827',
    textSecondary: '#6b7280',
    border: '#e5e7eb',
    error: '#ef4444',
    success: '#10b981',
  },
  fonts: {
    family:
      "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif",
    sizes: {
      sm: '0.875rem',
      md: '1rem',
      lg: '1.125rem',
      xl: '1.25rem',
    },
  },
  spacing: {
    xs: '0.25rem',
    sm: '0.5rem',
    md: '1rem',
    lg: '1.5rem',
    xl: '2rem',
  },
  borderRadius: {
    sm: '0.25rem',
    md: '0.5rem',
    lg: '0.75rem',
    full: '9999px',
  },
};

export const darkTheme: Theme = {
  ...lightTheme,
  colors: {
    primary: '#3b82f6',
    primaryHover: '#2563eb',
    secondary: '#9ca3af',
    secondaryHover: '#d1d5db',
    background: '#111827',
    surface: '#1f2937',
    text: '#f9fafb',
    textSecondary: '#9ca3af',
    border: '#374151',
    error: '#f87171',
    success: '#34d399',
  },
};

export function getTheme(mode: 'light' | 'dark' | 'auto'): Theme {
  if (mode === 'auto') {
    if (typeof window !== 'undefined' && window.matchMedia) {
      return window.matchMedia('(prefers-color-scheme: dark)').matches ? darkTheme : lightTheme;
    }
    return lightTheme;
  }
  return mode === 'dark' ? darkTheme : lightTheme;
}

export function themeToCssVars(theme: Theme): string {
  return `
    --sp-color-primary: ${theme.colors.primary};
    --sp-color-primary-hover: ${theme.colors.primaryHover};
    --sp-color-secondary: ${theme.colors.secondary};
    --sp-color-secondary-hover: ${theme.colors.secondaryHover};
    --sp-color-background: ${theme.colors.background};
    --sp-color-surface: ${theme.colors.surface};
    --sp-color-text: ${theme.colors.text};
    --sp-color-text-secondary: ${theme.colors.textSecondary};
    --sp-color-border: ${theme.colors.border};
    --sp-color-error: ${theme.colors.error};
    --sp-color-success: ${theme.colors.success};
    --sp-font-family: ${theme.fonts.family};
    --sp-font-size-sm: ${theme.fonts.sizes.sm};
    --sp-font-size-md: ${theme.fonts.sizes.md};
    --sp-font-size-lg: ${theme.fonts.sizes.lg};
    --sp-font-size-xl: ${theme.fonts.sizes.xl};
    --sp-spacing-xs: ${theme.spacing.xs};
    --sp-spacing-sm: ${theme.spacing.sm};
    --sp-spacing-md: ${theme.spacing.md};
    --sp-spacing-lg: ${theme.spacing.lg};
    --sp-spacing-xl: ${theme.spacing.xl};
    --sp-radius-sm: ${theme.borderRadius.sm};
    --sp-radius-md: ${theme.borderRadius.md};
    --sp-radius-lg: ${theme.borderRadius.lg};
    --sp-radius-full: ${theme.borderRadius.full};
  `;
}
