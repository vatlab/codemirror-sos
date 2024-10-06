import {LRLanguage, LanguageSupport} from "@codemirror/language";
import {python} from "@codemirror/lang-python";


const sosLanguage = LRLanguage.define({
  wrap: python().language.parser
});

export function sos() {
  return new LanguageSupport(sosLanguage);
}
