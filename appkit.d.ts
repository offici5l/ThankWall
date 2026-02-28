declare global {
  namespace React.JSX {
    interface IntrinsicElements {
      'appkit-button': { size?: 'sm' | 'md'; [key: string]: unknown }
    }
  }
}

export {}
