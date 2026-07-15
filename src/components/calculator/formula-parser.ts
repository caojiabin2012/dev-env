type TokenType = 'number' | 'operator' | 'function' | 'lparen' | 'rparen' | 'postfix'

interface Token {
  type: TokenType
  value: string
}

interface OperatorInfo {
  precedence: number
  associativity: 'left' | 'right'
  arity: number
}

const operators: Record<string, OperatorInfo> = {
  '+': { precedence: 1, associativity: 'left', arity: 2 },
  '-': { precedence: 1, associativity: 'left', arity: 2 },
  '*': { precedence: 2, associativity: 'left', arity: 2 },
  '/': { precedence: 2, associativity: 'left', arity: 2 },
  '^': { precedence: 3, associativity: 'right', arity: 2 },
}

const functions = new Set([
  'sin', 'cos', 'tan', 'asin', 'acos', 'atan',
  'sinh', 'cosh', 'tanh',
  'log', 'ln', 'sqrt', 'cbrt', 'abs',
  'ceil', 'floor', 'round',
  'exp', 'log2',
])

const constants: Record<string, number> = {
  'π': Math.PI,
  'pi': Math.PI,
  'e': Math.E,
}

export function tokenize(expr: string): Token[] {
  const tokens: Token[] = []
  let i = 0

  while (i < expr.length) {
    const ch = expr[i]

    if (ch === ' ') {
      i++
      continue
    }

    if (ch === '(') {
      tokens.push({ type: 'lparen', value: '(' })
      i++
      continue
    }

    if (ch === ')') {
      tokens.push({ type: 'rparen', value: ')' })
      i++
      continue
    }

    if (ch === ',' ) {
      i++
      continue
    }

    if ('+-*/^'.includes(ch)) {
      tokens.push({ type: 'operator', value: ch })
      i++
      continue
    }

    if (ch === '!' || ch === '%') {
      tokens.push({ type: 'postfix', value: ch })
      i++
      continue
    }

    if (ch >= '0' && ch <= '9' || ch === '.') {
      let num = ''
      while (i < expr.length && (expr[i] >= '0' && expr[i] <= '9' || expr[i] === '.')) {
        num += expr[i]
        i++
      }
      if (i < expr.length && expr[i] === 'e') {
        num += expr[i]
        i++
        if (i < expr.length && (expr[i] === '+' || expr[i] === '-')) {
          num += expr[i]
          i++
        }
        while (i < expr.length && expr[i] >= '0' && expr[i] <= '9') {
          num += expr[i]
          i++
        }
      }
      tokens.push({ type: 'number', value: num })
      continue
    }

    if (ch === '√') {
      tokens.push({ type: 'function', value: 'sqrt' })
      i++
      continue
    }

    if (ch === '∛') {
      tokens.push({ type: 'function', value: 'cbrt' })
      i++
      continue
    }

    if (ch === 'π' || ch === 'e') {
      if (ch === 'e' && i + 1 < expr.length && expr[i + 1] >= '0' && expr[i + 1] <= '9') {
        let num = 'e'
        i++
        if (i < expr.length && (expr[i] === '+' || expr[i] === '-')) {
          num += expr[i]
          i++
        }
        while (i < expr.length && expr[i] >= '0' && expr[i] <= '9') {
          num += expr[i]
          i++
        }
        tokens.push({ type: 'number', value: num })
      } else {
        tokens.push({ type: 'number', value: ch })
        i++
      }
      continue
    }

    if ((ch >= 'a' && ch <= 'z') || (ch >= 'A' && ch <= 'Z')) {
      let name = ''
      while (i < expr.length && ((expr[i] >= 'a' && expr[i] <= 'z') || (expr[i] >= 'A' && expr[i] <= 'Z'))) {
        name += expr[i]
        i++
      }

      if (functions.has(name)) {
        tokens.push({ type: 'function', value: name })
      } else if (constants[name] !== undefined) {
        tokens.push({ type: 'number', value: name })
      } else if (name === 'root' || name === 'log') {
        tokens.push({ type: 'function', value: name })
      } else {
        tokens.push({ type: 'number', value: '0' })
      }
      continue
    }

    i++
  }

  return tokens
}

function applyFunction(name: string, args: number[]): number {
  switch (name) {
    case 'sin': return Math.sin(args[0])
    case 'cos': return Math.cos(args[0])
    case 'tan': return Math.tan(args[0])
    case 'asin': return Math.asin(args[0])
    case 'acos': return Math.acos(args[0])
    case 'atan': return Math.atan(args[0])
    case 'sinh': return Math.sinh(args[0])
    case 'cosh': return Math.cosh(args[0])
    case 'tanh': return Math.tanh(args[0])
    case 'log': return args.length > 1 ? Math.log(args[0]) / Math.log(args[1]) : Math.log10(args[0])
    case 'ln': return Math.log(args[0])
    case 'sqrt': return Math.sqrt(args[0])
    case 'cbrt': return Math.cbrt(args[0])
    case 'abs': return Math.abs(args[0])
    case 'ceil': return Math.ceil(args[0])
    case 'floor': return Math.floor(args[0])
    case 'round': return Math.round(args[0])
    case 'exp': return Math.exp(args[0])
    case 'log2': return Math.log2(args[0])
    case 'root': return Math.pow(args[0], 1 / args[1])
    default: return NaN
  }
}

export function evaluate(expr: string, angleMode: 'deg' | 'rad' = 'deg'): number {
  const toRad = (x: number) => angleMode === 'deg' ? (x * Math.PI) / 180 : x
  const fromRad = (x: number) => angleMode === 'deg' ? (x * 180) / Math.PI : x

  const processedExpr = expr
    .replace(/(\d+(?:\.\d+)?)(\(|[a-zA-Zπ])/g, '$1*$2')
    .replace(/\)([\d.(])/g, ')*$1')
    .replace(/\)\(/g, ')*(')

  const tokens = tokenize(processedExpr)
  const outputQueue: (number | string)[] = []
  const operatorStack: Token[] = []

  const trigFunctions = new Set(['sin', 'cos', 'tan'])

  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i]
    const prevToken = i > 0 ? tokens[i - 1] : null

    const isUnary = !prevToken ||
      prevToken.type === 'operator' ||
      prevToken.type === 'lparen' ||
      prevToken.type === 'function'

    if (token.type === 'number') {
      if (token.value === 'π' || token.value === 'pi') {
        outputQueue.push(Math.PI)
      } else if (token.value === 'e') {
        outputQueue.push(Math.E)
      } else {
        outputQueue.push(parseFloat(token.value))
      }
    } else if (token.type === 'function') {
      operatorStack.push(token)
    } else if (token.type === 'lparen') {
      operatorStack.push(token)
    } else if (token.type === 'rparen') {
      while (operatorStack.length > 0 && operatorStack[operatorStack.length - 1].type !== 'lparen') {
        outputQueue.push(operatorStack.pop()!.value)
      }
      if (operatorStack.length > 0) {
        operatorStack.pop()
      }
      if (operatorStack.length > 0 && operatorStack[operatorStack.length - 1].type === 'function') {
        outputQueue.push(operatorStack.pop()!.value)
      }
    } else if (token.type === 'postfix') {
      outputQueue.push(token.value)
    } else if (token.type === 'operator') {
      if (token.value === '-' && isUnary) {
        outputQueue.push(0)
        token.value = 'neg'
        operatorStack.push(token)
        continue
      }
      if (token.value === '+' && isUnary) {
        continue
      }

      const opInfo = operators[token.value]
      while (
        operatorStack.length > 0 &&
        operatorStack[operatorStack.length - 1].type === 'operator' &&
        operators[operatorStack[operatorStack.length - 1].value] &&
        (
          (operators[operatorStack[operatorStack.length - 1].value].precedence > opInfo.precedence) ||
          (operators[operatorStack[operatorStack.length - 1].value].precedence === opInfo.precedence && opInfo.associativity === 'left')
        )
      ) {
        outputQueue.push(operatorStack.pop()!.value)
      }
      operatorStack.push(token)
    }
  }

  while (operatorStack.length > 0) {
    outputQueue.push(operatorStack.pop()!.value)
  }

  const evalStack: number[] = []

  for (const item of outputQueue) {
    if (typeof item === 'number') {
      evalStack.push(item)
    } else if (item === 'neg') {
      if (evalStack.length < 1) throw new Error('Invalid expression')
      evalStack.push(-evalStack.pop()!)
    } else if (item in operators) {
      if (evalStack.length < 2) throw new Error('Invalid expression')
      const b = evalStack.pop()!
      const a = evalStack.pop()!
      switch (item) {
        case '+': evalStack.push(a + b); break
        case '-': evalStack.push(a - b); break
        case '*': evalStack.push(a * b); break
        case '/':
          if (b === 0) throw new Error('Cannot divide by zero')
          evalStack.push(a / b)
          break
        case '^': evalStack.push(Math.pow(a, b)); break
      }
    } else if (item === '!') {
      if (evalStack.length < 1) throw new Error('Invalid expression')
      const n = evalStack.pop()!
      if (n < 0 || !Number.isInteger(n)) throw new Error('Factorial requires non-negative integer')
      let result = 1
      for (let i = 2; i <= n; i++) result *= i
      evalStack.push(result)
    } else if (item === '%') {
      if (evalStack.length < 1) throw new Error('Invalid expression')
      evalStack.push(evalStack.pop()! / 100)
    } else if (functions.has(item)) {
      const funcName = item
      const args: number[] = []

      if (funcName === 'root' || funcName === 'log') {
        if (evalStack.length < 2) throw new Error('Invalid expression')
        args.push(evalStack.pop()!)
        args.push(evalStack.pop()!)
        args.reverse()
      } else {
        if (evalStack.length < 1) throw new Error('Invalid expression')
        args.push(evalStack.pop()!)
      }

      let result = applyFunction(funcName, args)

      if (trigFunctions.has(funcName) && angleMode === 'deg') {
        const input = args[0]
        const radInput = toRad(input)
        result = applyFunction(funcName, [radInput])
      } else if (funcName === 'asin' || funcName === 'acos' || funcName === 'atan') {
        const resultRad = applyFunction(funcName, args)
        result = fromRad(resultRad)
      }

      evalStack.push(result)
    }
  }

  if (evalStack.length !== 1) {
    throw new Error('Invalid expression')
  }

  return evalStack[0]
}

export function formatResult(num: number): string {
  if (!isFinite(num)) {
    if (isNaN(num)) return 'Error'
    return num > 0 ? 'Infinity' : '-Infinity'
  }

  if (Number.isInteger(num) && Math.abs(num) < 1e15) {
    return num.toLocaleString('en-US')
  }

  const str = num.toPrecision(12)
  const parsed = parseFloat(str)

  if (Math.abs(parsed) < 1e-10 && parsed !== 0) {
    return parsed.toExponential(6)
  }

  if (Math.abs(parsed) >= 1e15) {
    return parsed.toExponential(6)
  }

  return parseFloat(parsed.toPrecision(10)).toString()
}
