export interface JsonTheme {
  name: string
  key: string
  string: string
  number: string
  boolean: string
  null: string
  bracket: string
}

export const jsonThemes: JsonTheme[] = [
  {
    name: 'Default',
    key: '#c084fc',
    string: '#4ade80',
    number: '#fb923c',
    boolean: '#22d3ee',
    null: '#f87171',
    bracket: '#facc15',
  },
  {
    name: 'One Dark Pro',
    key: '#c678dd',
    string: '#98c379',
    number: '#d19a66',
    boolean: '#56b6c2',
    null: '#e06c75',
    bracket: '#abb2bf',
  },
  {
    name: 'Monokai',
    key: '#f92672',
    string: '#e6db74',
    number: '#ae81ff',
    boolean: '#66d9ef',
    null: '#f92672',
    bracket: '#f8f8f2',
  },
  {
    name: 'Dracula',
    key: '#ff79c6',
    string: '#f1fa8c',
    number: '#bd93f9',
    boolean: '#8be9fd',
    null: '#ff5555',
    bracket: '#f8f8f2',
  },
  {
    name: 'GitHub Dark',
    key: '#79c0ff',
    string: '#a5d6ff',
    number: '#79c0ff',
    boolean: '#ff7b72',
    null: '#ff7b72',
    bracket: '#8b949e',
  },
]
