
import {parser} from "@lezer/python"
import {SyntaxNode} from "@lezer/common"
import {delimitedIndent, indentNodeProp, TreeIndentContext,
        foldNodeProp, foldInside, LRLanguage, LanguageSupport} from "@codemirror/language"
import {globalCompletion, localCompletionSource} from "./complete"
export {globalCompletion, localCompletionSource}



import { parser, configureNesting } from "@lezer/python"
import { Parser } from "@lezer/common"

import { pythonLanguage  } from "@codemirror/lang-python"
import { rLanguage } from "codemirror-lang-r"
import { markdownLanguage } from "@codemirror/lang-markdown"
import { javascriptLanguage} from "@codemirror/lang-javascript"

import { StreamLanguage } from "@codemirror/language"
import { ruby } from "@codemirror/legacy-modes/mode/ruby"
import { sas } from "@codemirror/legacy-modes/mode/sas"
import { octave } from "@codemirror/legacy-modes/mode/octave"
import { perl } from "@codemirror/legacy-modes/mode/perl"
import { shell } from "@codemirror/legacy-modes/mode/shell"
import { EditorView } from "@codemirror/view"
import { EditorSelection } from "@codemirror/state"
import {
  LRLanguage, indentNodeProp, foldNodeProp, LanguageSupport, syntaxTree,
  bracketMatchingHandle
} from "@codemirror/language"
import { elementName, htmlCompletionSourceWith, TagSpec, eventAttributes } from "./complete"
export { htmlCompletionSource, TagSpec, htmlCompletionSourceWith } from "./complete"

type ActionLang = {
  action: string,
  sigil?: (attrs: { [attr: string]: string }) => boolean,
  parser: Parser
}

const defaulAction: ActionLang[] = [
  {
    action: "Python",
    parser: pythonLanguage.parser
  },
  {
    action: "R",
    parser: rLanguage.parser
  },
  {
    action: "Javascript",
    parser: javascriptLanguage.parser
  },
  {
    action: "matlab",
    parser: StreamLanguage.define(octave).parser
  },
  {
    action: "octave",
    parser: StreamLanguage.define(octave).parser
  },
  {
    action: "ruby",
    parser: StreamLanguage.define(ruby).parser
  },
  {
    action: "markdown",
    parser: markdownLanguage.parser
  },
  {
    action: "perl",
    parser: StreamLanguage.define(perl).parser
  },
  {
    action: "shell",
    parser: StreamLanguage.define(shell).parser
  },
  {
    action: "run",
    parser: StreamLanguage.define(shell).parser
  },
  {
    action: "sh",
    parser: StreamLanguage.define(shell).parser
  },
  {
    action: "bash",
    parser: StreamLanguage.define(shell).parser
  },
  {
    action: "sas",
    parser: StreamLanguage.define(sas).parser
  }
]

function indentBody(context: TreeIndentContext, node: SyntaxNode) {
  let base = context.baseIndentFor(node)
  let line = context.lineAt(context.pos, -1), to = line.from + line.text.length
  // Don't consider blank, deindented lines at the end of the
  // block part of the block
  if (/^\s*($|#)/.test(line.text) &&
      context.node.to < to + 100 &&
      !/\S/.test(context.state.sliceDoc(to, context.node.to)) &&
      context.lineIndent(context.pos, -1) <= base)
    return null
  // A normally deindenting keyword that appears at a higher
  // indentation than the block should probably be handled by the next
  // level
  if (/^\s*(else:|elif |except |finally:)/.test(context.textAfter) && context.lineIndent(context.pos, -1) > base)
    return null
  return base + context.unit
}

/// A language provider based on the [Lezer Python
/// parser](https://github.com/lezer-parser/python), extended with
/// highlighting and indentation information.
export const pythonLanguage = LRLanguage.define({
  name: "python",
  parser: parser.configure({
    props: [
      indentNodeProp.add({
        Body: context => indentBody(context, context.node) ?? context.continue(),
        IfStatement: cx => /^\s*(else:|elif )/.test(cx.textAfter) ? cx.baseIndent : cx.continue(),
        TryStatement: cx => /^\s*(except |finally:|else:)/.test(cx.textAfter) ? cx.baseIndent : cx.continue(),
        "TupleExpression ComprehensionExpression ParamList ArgList ParenthesizedExpression": delimitedIndent({closing: ")"}),
        "DictionaryExpression DictionaryComprehensionExpression SetExpression SetComprehensionExpression": delimitedIndent({closing: "}"}),
        "ArrayExpression ArrayComprehensionExpression": delimitedIndent({closing: "]"}),
        "String FormatString": () => null,
        Script: context => {
          if (context.pos + /\s*/.exec(context.textAfter)![0].length >= context.node.to) {
            let endBody = null
            for (let cur: SyntaxNode | null = context.node, to = cur.to;;) {
              cur = cur.lastChild
              if (!cur || cur.to != to) break
              if (cur.type.name == "Body") endBody = cur
            }
            if (endBody) {
              let bodyIndent = indentBody(context, endBody)
              if (bodyIndent != null) return bodyIndent
            }
          }
          return context.continue()
        }
      }),
      foldNodeProp.add({
        "ArrayExpression DictionaryExpression SetExpression TupleExpression": foldInside,
        Body: (node, state) => ({from: node.from + 1, to: node.to - (node.to == state.doc.length ? 0 : 1)})
      })
    ],
  }),
  languageData: {
    closeBrackets: {
      brackets: ["(", "[", "{", "'", '"', "'''", '"""'],
      stringPrefixes: ["f", "fr", "rf", "r", "u", "b", "br", "rb",
                       "F", "FR", "RF", "R", "U", "B", "BR", "RB"]
    },
    commentTokens: {line: "#"},
    indentOnInput: /^\s*([\}\]\)]|else:|elif |except |finally:)$/
  }
})

/// Python language support.
export function python() {
  return new LanguageSupport(pythonLanguage, [
    pythonLanguage.data.of({autocomplete: localCompletionSource}),
    pythonLanguage.data.of({autocomplete: globalCompletion}),
  ])
}

export const SoS = LRLanguage.define({
  name: "SoS",
  parser: parser.configure({
    props: [
      indentNodeProp.add({
        Element(context) {
          let after = /^(\s*)(<\/)?/.exec(context.textAfter)!
          if (context.node.to <= context.pos + after[0].length) return context.continue()
          return context.lineIndent(context.node.from) + (after[2] ? 0 : context.unit)
        },
        "OpenTag CloseTag SelfClosingTag"(context) {
          return context.column(context.node.from) + context.unit
        },
        Document(context) {
          if (context.pos + /\s*/.exec(context.textAfter)![0].length < context.node.to)
            return context.continue()
          let endElt = null, close
          for (let cur = context.node; ;) {
            let last = cur.lastChild
            if (!last || last.name != "Element" || last.to != cur.to) break
            endElt = cur = last
          }
          if (endElt && !((close = endElt.lastChild) && (close.name == "CloseTag" || close.name == "SelfClosingTag")))
            return context.lineIndent(endElt.from) + context.unit
          return null
        }
      }),
      foldNodeProp.add({
        Element(node) {
          let first = node.firstChild, last = node.lastChild!
          if (!first || first.name != "OpenTag") return null
          return { from: first.to, to: last.name == "CloseTag" ? last.from : node.to }
        }
      }),
      bracketMatchingHandle.add({
        "OpenTag CloseTag": node => node.getChild("TagName")
      })
    ]
  }),
  languageData: {
  }
})


export const htmlLanguage = htmlPlain.configure({
  wrap: configureNesting(defaultNesting, defaultAttrs)
})


export function sos(config: {
  matchClosingTags?: boolean,
  selfClosingTags?: boolean,
  autoCloseTags?: boolean,
  extraTags?: Record<string, TagSpec>,
  extraGlobalAttributes?: Record<string, null | readonly string[]>,
  nestedLanguages?: NestedLang[]
  nestedAttributes?: NestedAttr[]
} = {}) {
  let dialect = "", wrap
  if (config.matchClosingTags === false) dialect = "noMatch"
  if (config.selfClosingTags === true) dialect = (dialect ? dialect + " " : "") + "selfClosing"
  if (config.nestedLanguages && config.nestedLanguages.length ||
    config.nestedAttributes && config.nestedAttributes.length)
    wrap = configureNesting((config.nestedLanguages || []).concat(defaultNesting),
      (config.nestedAttributes || []).concat(defaultAttrs))
  let lang = wrap ? htmlPlain.configure({ wrap, dialect }) : dialect ? htmlLanguage.configure({ dialect }) : htmlLanguage
  return new LanguageSupport(lang, [
    htmlLanguage.data.of({ autocomplete: htmlCompletionSourceWith(config) }),
    config.autoCloseTags !== false ? autoCloseTags : [],
    javascript().support,
    css().support
  ])
}

const selfClosers = new Set(
  "area base br col command embed frame hr img input keygen link meta param source track wbr menuitem".split(" "))

/// Extension that will automatically insert close tags when a `>` or
/// `/` is typed.
export const autoCloseTags = EditorView.inputHandler.of((view, from, to, text, insertTransaction) => {
  if (view.composing || view.state.readOnly || from != to || (text != ">" && text != "/") ||
    !htmlLanguage.isActiveAt(view.state, from, -1)) return false
  let base = insertTransaction(), { state } = base
  let closeTags = state.changeByRange(range => {
    let didType = state.doc.sliceString(range.from - 1, range.to) == text
    let { head } = range, around = syntaxTree(state).resolveInner(head - 1, -1), name
    if (around.name == "TagName" || around.name == "StartTag") around = around.parent!
    if (didType && text == ">" && around.name == "OpenTag") {
      if (around.parent?.lastChild?.name != "CloseTag" &&
        (name = elementName(state.doc, around.parent, head)) &&
        !selfClosers.has(name)) {
        let to = head + (state.doc.sliceString(head, head + 1) === ">" ? 1 : 0)
        let insert = `</${name}>`
        return { range, changes: { from: head, to, insert } }
      }
    } else if (didType && text == "/" && around.name == "IncompleteCloseTag") {
      let base = around.parent!
      if (around.from == head - 2 && base.lastChild?.name != "CloseTag" &&
        (name = elementName(state.doc, base, head)) && !selfClosers.has(name)) {
        let to = head + (state.doc.sliceString(head, head + 1) === ">" ? 1 : 0)
        let insert = `${name}>`
        return {
          range: EditorSelection.cursor(head + insert.length, -1),
          changes: { from: head, to, insert }
        }
      }
    }
    return { range }
  })
  if (closeTags.changes.empty) return false
  view.dispatch([
    base,
    state.update(closeTags, {
      userEvent: "input.complete",
      scrollIntoView: true
    })
  ])
  return true
})