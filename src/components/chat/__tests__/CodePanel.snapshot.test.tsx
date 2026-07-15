/**
 * Snapshot tests for CodePanel with syntax highlighting.
 *
 * Captures rendered output for various code snippets and languages,
 * verifying the syntax highlighting output is consistent across renders.
 *
 * Requirements: 2.1, 2.4
 */

import React from 'react';
import { render } from '@testing-library/react-native';

import { CodePanel } from '../CodePanel';

// Mock theme
jest.mock('@/theme', () => ({
  useTheme: () => ({
    colors: {
      codeBlockBackground: '#15151b',
      codeKeyword: '#9896E6',
      codeString: '#CDCCF3',
      codeType: '#9999ED',
      codeComment: '#8E8E93',
      accent: '#5856D6',
    },
    typography: {
      code: { fontSize: 15, lineHeight: 20 },
      caption1: { fontSize: 12, lineHeight: 16 },
    },
    spacing: { sm: 8, md: 12 },
    borderRadii: { codeBlock: 10 },
    isDark: false,
  }),
}));

// Mock toast
jest.mock('@/components/overlays/ToastProvider', () => ({
  useToast: () => ({ show: jest.fn() }),
}));

// Mock clipboard
jest.mock('@/utils/clipboard', () => ({
  copyToClipboard: jest.fn().mockResolvedValue(undefined),
}));

describe('CodePanel Snapshot Tests', () => {
  describe('JavaScript syntax highlighting', () => {
    it('renders a JavaScript function with highlighting', () => {
      const code = `function greet(name) {
  const message = "Hello, " + name;
  return message;
}`;
      const tree = render(<CodePanel code={code} language="javascript" />);
      expect(tree.toJSON()).toMatchSnapshot();
    });

    it('renders JavaScript with comments and strings', () => {
      const code = `// Initialize the app
const API_URL = "https://api.example.com";
/* Multi-line
   comment */
let count = 42;`;
      const tree = render(<CodePanel code={code} language="javascript" />);
      expect(tree.toJSON()).toMatchSnapshot();
    });
  });

  describe('TypeScript syntax highlighting', () => {
    it('renders TypeScript with type annotations', () => {
      const code = `interface User {
  id: string;
  name: string;
  age: number;
}

function getUser(id: string): Promise<User> {
  return fetch(\`/api/users/\${id}\`).then(r => r.json());
}`;
      const tree = render(<CodePanel code={code} language="typescript" />);
      expect(tree.toJSON()).toMatchSnapshot();
    });
  });

  describe('Python syntax highlighting', () => {
    it('renders Python with classes and decorators', () => {
      const code = `# A simple Python class
class Calculator:
    def __init__(self):
        self.result = 0

    def add(self, value: int) -> int:
        self.result += value
        return self.result`;
      const tree = render(<CodePanel code={code} language="python" />);
      expect(tree.toJSON()).toMatchSnapshot();
    });
  });

  describe('Swift syntax highlighting', () => {
    it('renders Swift with struct and protocol', () => {
      const code = `struct ContentView: View {
    @State private var count: Int = 0

    var body: some View {
        Text("Count: \\(count)")
    }
}`;
      const tree = render(<CodePanel code={code} language="swift" />);
      expect(tree.toJSON()).toMatchSnapshot();
    });
  });

  describe('Rust syntax highlighting', () => {
    it('renders Rust with ownership patterns', () => {
      const code = `fn main() {
    let s = String::from("hello");
    let len = calculate_length(&s);
    println!("Length of '{}' is {}.", s, len);
}

fn calculate_length(s: &String) -> usize {
    s.len()
}`;
      const tree = render(<CodePanel code={code} language="rust" />);
      expect(tree.toJSON()).toMatchSnapshot();
    });
  });

  describe('Plain text (no language)', () => {
    it('renders plain text without syntax highlighting', () => {
      const code = `Some plain text output
without any syntax highlighting.
Line three.`;
      const tree = render(<CodePanel code={code} />);
      expect(tree.toJSON()).toMatchSnapshot();
    });
  });

  describe('Unrecognized language', () => {
    it('renders as plain text with no language label', () => {
      const code = `custom language code here
  indented content
end`;
      const tree = render(<CodePanel code={code} language="brainfuck" />);
      expect(tree.toJSON()).toMatchSnapshot();
    });
  });

  describe('Language aliases', () => {
    it('renders js alias as javascript', () => {
      const code = `const x = [1, 2, 3].map(n => n * 2);`;
      const tree = render(<CodePanel code={code} language="js" />);
      expect(tree.toJSON()).toMatchSnapshot();
    });

    it('renders ts alias as typescript', () => {
      const code = `const arr: Array<number> = [1, 2, 3];`;
      const tree = render(<CodePanel code={code} language="ts" />);
      expect(tree.toJSON()).toMatchSnapshot();
    });
  });

  describe('Edge cases', () => {
    it('renders empty code string', () => {
      const tree = render(<CodePanel code="" language="javascript" />);
      expect(tree.toJSON()).toMatchSnapshot();
    });

    it('renders single-line code', () => {
      const code = `console.log("hello");`;
      const tree = render(<CodePanel code={code} language="javascript" />);
      expect(tree.toJSON()).toMatchSnapshot();
    });

    it('renders long single line for horizontal scroll', () => {
      const code = `const veryLongVariableName = someFunction(argument1, argument2, argument3, argument4, argument5, argument6, argument7);`;
      const tree = render(<CodePanel code={code} language="javascript" />);
      expect(tree.toJSON()).toMatchSnapshot();
    });
  });
});
