import { preprocessInput, isAlpha, isSpace } from './utils';
import { EntityParser, TokenizerDelegate } from './types';

const enum TokenizerState {
  beforeData = 'beforeData',
  data = 'data',
  atRuleStart = 'atRuleStart',
  ruleSelectorStart = 'ruleSelectorStart',
  ruleSelectorEnd = 'ruleSelectorEnd',
  declPropStart = 'declPropStart',
  declPropEnd = 'declPropEnd',
}

export default class EventedCssTokenizer {
  public state: TokenizerState = TokenizerState.beforeData;

  public line = -1;
  public column = -1;

  private input = '';
  private index = -1;

  private atRuleBuffer = '';
  private ruleSelectorBuffer = '';
  private declPropBuffer = '';

  constructor(
    private delegate: TokenizerDelegate,
    private entityParser: EntityParser,
    private mode: 'codemod' | 'precompile' = 'precompile'
  ) {
    this.reset();
  }

  reset() {
    this.transitionTo(TokenizerState.beforeData);
    this.input = '';
    this.ruleSelectorBuffer = '';
    this.declPropBuffer = '';

    this.index = 0;
    this.line = 1;
    this.column = 0;

    this.delegate.reset();
  }

  transitionTo(state: TokenizerState) {
    this.state = state;
  }

  tokenize(input: string) {
    this.reset();
    this.tokenizePart(input);
    this.tokenizeEOF();
  }

  tokenizePart(input: string) {
    this.input += preprocessInput(input);

    while (this.index < this.input.length) {
      let handler = this.states[this.state];
      if (handler !== undefined) {
        handler.call(this);
      } else {
        throw new Error(`unhandled state ${this.state}`);
      }
    }
  }

  tokenizeEOF() {
    this.flushData();
  }

  flushData() {
    if (this.state === 'data') {
      this.delegate.finishData();
      this.transitionTo(TokenizerState.beforeData);
    }
  }

  peek() {
    return this.input.charAt(this.index);
  }

  consume() {
    let char = this.peek();

    this.index++;

    if (char === '\n') {
      this.line++;
      this.column = 0;
    } else {
      this.column++;
    }

    return char;
  }

  markAtRuleStart() {
    // todo
    // this.delegate.tagOpen();
  }

  markRuleStart() {
    // todo
    // this.delegate.tagOpen();
  }

  private appendToRuleSelector(char: string) : void {
    this.ruleSelectorBuffer += char;
    this.delegate.appendToRuleSelector(char);
  }

  private finishRuleSelector(): void {
    this.delegate.finishRuleSelector();
    this.transitionTo(TokenizerState.ruleSelectorEnd);
    this.ruleSelectorBuffer = ''
  }

  private appendToDeclProp(char: string): void {
    this.declPropBuffer += char;
    this.delegate.appendToDeclProp(char);
  }

  states: { [k in TokenizerState]?: (this: EventedCssTokenizer) => void } = {
    beforeData() {
      let char = this.peek();

      if (char === '@') {
        // todo
        this.transitionTo(TokenizerState.atRuleStart);
        this.markAtRuleStart();
        this.consume();
      } else if (char === '.' || char === '#' || isAlpha(char)) {
        this.transitionTo(TokenizerState.ruleSelectorStart)
        this.appendToRuleSelector(char)
        this.markRuleStart();
        this.consume();
      }
    },

    ruleSelectorStart() {
      let char = this.consume();

      if (char === '{') {
        this.finishRuleSelector()
      } else {
        this.appendToRuleSelector(char);
      }
    },

    ruleSelectorEnd() {
      let char = this.consume();
      
      if (isAlpha(char)) {
        this.transitionTo(TokenizerState.declPropStart)
        this.appendToDeclProp(char)
      } else if (char === ':') {
        this.transitionTo(TokenizerState.declPropEnd)
        this.delegate.finishDeclProp();
      }
    },


  };
}
