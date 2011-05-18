(function () {
// ==ClosureCompiler==
// @compilation_level ADVANCED_OPTIMIZATIONS
// ==/ClosureCompiler==


/**
 * @fileoverview
 * Definitions of sanitization functions and sanitized content wrappers.
 * See http://js-quasis-libraries-and-repl.googlecode.com/svn/trunk/safetemplate.html#sanitization_functions
 * for definitions of sanitization functions and sanitized content wrappers.
 */

/**
 * A snippet of HTML that does not start or end inside a tag, comment, entity,
 * or DOCTYPE; and that does not contain any executable code
 * (JS, {@code <object>}s, etc.) from a different trust domain.
 * @const
 */
var CONTENT_KIND_HTML = 0;

/**
 * A sequence of code units that can appear between quotes (either kind) in a
 * JS program without causing a parse error, and without causing any side
 * effects.
 * <p>
 * The content should not contain unescaped quotes, newlines, or anything else
 * that would cause parsing to fail or to cause a JS parser to finish the
 * string its parsing inside the content.
 * <p>
 * The content must also not end inside an escape sequence ; no partial octal
 * escape sequences or odd number of '{@code \}'s at the end.
 * @const
 */
var CONTENT_KIND_JS_STR_CHARS = 1;

/** A properly encoded portion of a URI.  @const */
var CONTENT_KIND_URI = 2;


/**
 * The name of the property that contains sanitized content in a sanitized
 * content wrapper.
 * This is a string stored in a constant so that it can be used in JSON
 * revivers.
 * @const
 */
var CONTENT_PROPNAME = 'content';

/**
 * The name of the property that contains a CONTENT_KIND_* enum value.
 * This is a string stored in a constant so that it can be used in JSON
 * revivers.
 * @const
 */
var CONTENT_KIND_PROPNAME = 'contentKind';


/**
 * Escapes HTML special characters in a string.  Escapes double quote '"' in
 * addition to '&', '<', and '>' so that a string can be included in an HTML
 * tag attribute value within double quotes.
 * Will emit known safe HTML as-is.
 *
 * @param {*} value The string-like value to be escaped.  May not be a string,
 *     but the value will be coerced to a string.
 * @return {string|SanitizedHtml} An escaped version of value.
 */
function escapeHtml(value) {
  if (value && value[CONTENT_KIND_PROPNAME] === CONTENT_KIND_HTML) {
    return /** @type {SanitizedHtml} */ (value);
  } else if (value instanceof Array) {
    return value.map(escapeHtml).join('');
  } else if (value === void 0) {
    return "";
  } else {
    return escapeHtmlHelper(value);
  }
}


/**
 * Escapes HTML special characters in a string so that it can be embedded in
 * RCDATA.
 * <p>
 * Escapes HTML special characters so that the value will not prematurely end
 * the body of a tag like {@code <textarea>} or {@code <title>}.  RCDATA tags
 * cannot contain other HTML entities, so it is not strictly necessary to escape
 * HTML special characters except when part of that text looks like an HTML
 * entity or like a close tag : {@code </textarea>}.
 * <p>
 * Will normalize known safe HTML to make sure that sanitized HTML (which could
 * contain an innocuous {@code </textarea>} don't prematurely end an RCDATA
 * element.
 *
 * @param {*} value The string-like value to be escaped.  May not be a string,
 *     but the value will be coerced to a string.
 * @return {string} An escaped version of value.
 */
function escapeHtmlRcdata(value) {
  if (value && value[CONTENT_KIND_PROPNAME] === CONTENT_KIND_HTML) {
    return normalizeHtmlHelper(value[CONTENT_PROPNAME]);
  }
  return escapeHtmlHelper(value);
}


/**
 * Removes HTML tags from a string of known safe HTML so it can be used as an
 * attribute value.
 *
 * @param {*} value The HTML to be escaped.  May not be a string, but the
 *     value will be coerced to a string.
 * @return {string} A representation of value without tags, HTML comments, or
 *     other content.
 */
function stripHtmlTags(value) {
  return String(value).replace(HTML_TAG_REGEX_, '');
}


/**
 * Escapes HTML special characters in an HTML attribute value.
 *
 * @param {*} value The HTML to be escaped.  May not be a string, but the
 *     value will be coerced to a string.
 * @return {string} An escaped version of value.
 */
function escapeHtmlAttribute(value) {
  if (value && value[CONTENT_KIND_PROPNAME] === CONTENT_KIND_HTML) {
    return normalizeHtmlHelper(stripHtmlTags(value[CONTENT_PROPNAME]));
  }
  return escapeHtmlHelper(value);
}


/**
 * Escapes HTML special characters in a string including space and other
 * characters that can end an unquoted HTML attribute value.
 *
 * @param {*} value The HTML to be escaped.  May not be a string, but the
 *     value will be coerced to a string.
 * @return {string} An escaped version of value.
 */
function escapeHtmlAttributeNospace(value) {
  if (value && value[CONTENT_KIND_PROPNAME] === CONTENT_KIND_HTML) {
    return normalizeHtmlNospaceHelper(
        stripHtmlTags(value[CONTENT_PROPNAME]));
  }
  return escapeHtmlNospaceHelper(value);
}


/**
 * Filters out strings that cannot be a substring of a valid HTML attribute.
 *
 * @param {*} value The value to escape.  May not be a string, but the value
 *     will be coerced to a string.
 * @return {string} A valid HTML attribute name part or name/value pair.
 *     {@code "zSafehtmlz"} if the input is invalid.
 */
function filterHtmlAttribute(value) {
  var str = filterHtmlAttributeHelper(value);
  var ch, eq = str.indexOf('=');
  return eq >= 0 && (ch = str.charAt(str.length - 1)) != '"' && ch != "'"
      // Quote any attribute values so that a contextually autoescaped whole
      // attribute does not end up having a following value associated with
      // it.
      // The contextual autoescaper, since it propagates context left to
      // right, is unable to distinguish
      //     <div {$x}>
      // from
      //     <div {$x}={$y}>.
      // If {$x} is "dir=ltr", and y is "foo" make sure the parser does not
      // see the attribute "dir=ltr=foo".
      ? str.substring(0, eq + 1) + '"' + str.substring(eq + 1) + '"'
      : str;
}


/**
 * Filters out strings that cannot be a substring of a valid HTML element name.
 *
 * @param {*} value The value to escape.  May not be a string, but the value
 *     will be coerced to a string.
 * @return {string} A valid HTML element name part.
 *     {@code "zSafehtmlz"} if the input is invalid.
 */
function filterHtmlElementName(value) {
  return filterHtmlElementNameHelper(value);
}


/**
 * Escapes characters in the value to make it valid content for a JS string
 * literal.
 *
 * @param {*} value The value to escape.  May not be a string, but the value
 *     will be coerced to a string.
 * @return {string} An escaped version of value.
 */
function escapeJsString(value) {
  if (value && value[CONTENT_KIND_PROPNAME] === CONTENT_KIND_JS_STR_CHARS) {
    return value[CONTENT_PROPNAME];
  }
  return escapeJsStringHelper(value);
}


/**
 * @param {string} ch
 * @return {string}
 * @private
 */
function escapeJsChar_(ch) {
  var s = ch.charCodeAt(0).toString(16);
  var prefix = s.length <= 2 ? '\\x00' : '\\u0000';
  return prefix.substring(0, prefix.length - s.length) + s;
}


/**
 * Encodes a value as a JavaScript literal.
 *
 * @param {*} value The value to escape.  May not be a string, but the value
 *     will be coerced to a string.
 * @return {string} A JavaScript code representation of the input.
 */
function escapeJsValue(value) {
  // We surround values with spaces so that they can't be interpolated into
  // identifiers by accident.
  // We could use parentheses but those might be interpreted as a function call.
  var type;
  return value == null  // Intentionally matches undefined.
      // We always output null for compatibility with Java/python server side
      // frameworks which do not have a distinct undefined value.
      ? ' null '
      : (type = typeof value) == "boolean" || type == "number"
        ? ' ' + value + ' '
        : "'" + escapeJsString(value) + "'";
}


/**
 * Escapes characters in the string to make it valid content for a JS regular
 * expression literal.
 *
 * @param {*} value The value to escape.  May not be a string, but the value
 *     will be coerced to a string.
 * @return {string} An escaped version of value.
 */
function escapeJsRegex(value) {
  return escapeJsRegexHelper(value);
}


/**
 * Matches all URI mark characters that conflict with HTML attribute delimiters
 * or that cannot appear in a CSS uri.
 * From <a href="http://www.w3.org/TR/CSS2/grammar.html">G.2: CSS grammar</a>
 * <pre>
 *     url        ([!#$%&*-~]|{nonascii}|{escape})*
 * </pre>
 *
 * @type {RegExp}
 * @private
 */
var problematicUriMarks_ = /['()]/g;

/**
 * @param {string} ch A single character in {@link problematicUriMarks_}.
 * @return {string}
 * @private
 */
function pctEncode_(ch) {
  return '%' + ch.charCodeAt(0).toString(16);
}

/**
 * Escapes a string so that it can be safely included in a URI.
 *
 * @param {*} value The value to escape.  May not be a string, but the value
 *     will be coerced to a string.
 * @return {string} An escaped version of value.
 */
function escapeUri(value) {
  if (value && value[CONTENT_KIND_PROPNAME] === CONTENT_KIND_URI) {
    return normalizeUri(value);
  }
  // Apostophes and parentheses are not matched by encodeURIComponent.
  // They are technically special in URIs, but only appear in the obsolete mark
  // production in Appendix D.2 of RFC 3986, so can be encoded without changing
  // semantics.
  var encoded = encodeURIComponent(/** @type {string} */ (value));
  return encoded.replace(problematicUriMarks_, pctEncode_);
}


/**
 * Removes rough edges from a URI by escaping any raw HTML/JS string delimiters.
 *
 * @param {*} value The value to escape.  May not be a string, but the value
 *     will be coerced to a string.
 * @return {string} An escaped version of value.
 */
function normalizeUri(value) {
  value = String(value);
  if (/[\0- "<>\\{}\x7f\x85\xa0\u2028\u2029\uff00-\uffff]|%(?![a-f0-9]{2})/i
      .test(value)) {
    var parts = value.split(/(%[a-f0-9]{2}|[#$&+,/:;=?@\[\]])/i);
    for (var i = parts.length - 1; i >= 0; i -= 2) {
      parts[i] = encodeURIComponent(parts[i]);
    }
    value = parts.join('');
  }
  return value.replace(problematicUriMarks_, pctEncode_);
}


/**
 * Vets a URI's protocol and removes rough edges from a URI by escaping
 * any raw HTML/JS string delimiters.
 *
 * @param {*} value The value to escape.  May not be a string, but the value
 *     will be coerced to a string.
 * @return {string} An escaped version of value.
 */
function filterNormalizeUri(value) {
  var str = String(value);
  if (!FILTER_FOR_FILTER_NORMALIZE_URI_.test(str)) {
    return '#zSafehtmlz';
  } else {
    return normalizeUri(value);
  }
}


/**
 * Escapes a string so it can safely be included inside a quoted CSS string.
 *
 * @param {*} value The value to escape.  May not be a string, but the value
 *     will be coerced to a string.
 * @return {string} An escaped version of value.
 */
function escapeCssString(value) {
  return escapeCssStringHelper(value);
}


/**
 * Encodes a value as a CSS identifier part, keyword, or quantity.
 *
 * @param {*} value The value to escape.  May not be a string, but the value
 *     will be coerced to a string.
 * @return {string} A safe CSS identifier part, keyword, or quanitity.
 */
function filterCssValue(value) {
  // Uses == to intentionally match null and undefined for Java compatibility.
  if (value == null) {
    return '';
  }
  return filterCssValueHelper(value);
}



// -----------------------------------------------------------------------------
// Generated code.


// START GENERATED CODE FOR ESCAPERS.

/**
 * Maps charcters to the escaped versions for the named escape directives.
 * @type {Object.<string, string>}
 * @private
 */
var ESCAPE_MAP_FOR_ESCAPE_HTML__AND__NORMALIZE_HTML__AND__ESCAPE_HTML_NOSPACE__AND__NORMALIZE_HTML_NOSPACE_ = {
  '\x22': '\x26quot;',
  '\x26': '\x26amp;',
  '\x3c': '\x26lt;',
  '\x3e': '\x26gt;'
};

/**
 * A function that can be used with String.replace..
 * @param {string} ch A single character matched by a compatible matcher.
 * @return {string} A token in the output language.
 * @private
 */
function REPLACER_FOR_ESCAPE_HTML__AND__NORMALIZE_HTML__AND__ESCAPE_HTML_NOSPACE__AND__NORMALIZE_HTML_NOSPACE_(ch) {
  return ESCAPE_MAP_FOR_ESCAPE_HTML__AND__NORMALIZE_HTML__AND__ESCAPE_HTML_NOSPACE__AND__NORMALIZE_HTML_NOSPACE_[ch]
      || (ESCAPE_MAP_FOR_ESCAPE_HTML__AND__NORMALIZE_HTML__AND__ESCAPE_HTML_NOSPACE__AND__NORMALIZE_HTML_NOSPACE_[ch] = '\x26#' + ch.charCodeAt(0) + ';');
}

/**
 * Maps charcters to the escaped versions for the named escape directives.
 * @type {Object.<string, string>}
 * @private
 */
var ESCAPE_MAP_FOR_ESCAPE_JS_STRING__AND__ESCAPE_JS_REGEX_ = {
  // We do not escape '\x08' to '\\b' since that means word-break in RegExps.
  '\x09': '\\t',
  '\x0a': '\\n',
  '\x0c': '\\f',
  '\x0d': '\\r',
  '\/': '\\\/',
  '\\': '\\\\'
};

/**
 * A function that can be used with String.replace..
 * @param {string} ch A single character matched by a compatible matcher.
 * @return {string} A token in the output language.
 * @private
 */
function REPLACER_FOR_ESCAPE_JS_STRING__AND__ESCAPE_JS_REGEX_(ch) {
  return ESCAPE_MAP_FOR_ESCAPE_JS_STRING__AND__ESCAPE_JS_REGEX_[ch]
     || (ESCAPE_MAP_FOR_ESCAPE_JS_STRING__AND__ESCAPE_JS_REGEX_[ch]
         = escapeJsChar_(ch));
}

/**
 * Maps charcters to the escaped versions for the named escape directives.
 * @type {Object.<string, string>}
 * @private
 */
var ESCAPE_MAP_FOR_ESCAPE_CSS_STRING_ = {};

/**
 * A function that can be used with String.replace..
 * @param {string} ch A single character matched by a compatible matcher.
 * @return {string} A token in the output language.
 * @private
 */
function REPLACER_FOR_ESCAPE_CSS_STRING_(ch) {
  return ESCAPE_MAP_FOR_ESCAPE_CSS_STRING_[ch] || (
     ESCAPE_MAP_FOR_ESCAPE_CSS_STRING_[ch]
         = '\\' + ch.charCodeAt(0).toString(16) + ' ');
}

/**
 * Matches characters that need to be escaped for the named directives.
 * @type RegExp
 * @private
 * @const
 */
var MATCHER_FOR_ESCAPE_HTML_ = /[\x00\x22\x26\x27\x3c\x3e]/g;

/**
 * Matches characters that need to be escaped for the named directives.
 * @type RegExp
 * @private
 * @const
 */
var MATCHER_FOR_NORMALIZE_HTML_ = /[\x00\x22\x27\x3c\x3e]/g;

/**
 * Matches characters that need to be escaped for the named directives.
 * @type RegExp
 * @private
 * @const
 */
var MATCHER_FOR_ESCAPE_HTML_NOSPACE_
    = /[\x00\x09-\x0d \x22\x26\x27\x2d\/\x3c-\x3e`\x85\xa0\u2028\u2029]/g;

/**
 * Matches characters that need to be escaped for the named directives.
 * @type RegExp
 * @private
 * @const
 */
var MATCHER_FOR_NORMALIZE_HTML_NOSPACE_
    = /[\x00\x09-\x0d \x22\x27\x2d\/\x3c-\x3e`\x85\xa0\u2028\u2029]/g;

/**
 * Matches characters that need to be escaped for the named directives.
 * @type RegExp
 * @private
 * @const
 */
var MATCHER_FOR_ESCAPE_JS_STRING_
    = /[\x00\x08-\x0d\x22\x26\x27\/\x3c-\x3e\\\x85\u2028\u2029]/g;

/**
 * Matches characters that need to be escaped for the named directives.
 * @type RegExp
 * @private
 * @const
 */
var MATCHER_FOR_ESCAPE_JS_REGEX_ = /[\x00\x08-\x0d\x22\x24\x26-\/\x3a\x3c-\x3f\x5b-\x5e\x7b-\x7d\x85\u2028\u2029]/g;

/**
 * Matches characters that need to be escaped for the named directives.
 * @type RegExp
 * @private
 * @const
 */
var MATCHER_FOR_ESCAPE_CSS_STRING_ = /[\x00\x08-\x0d\x22\x26-\x2a\/\x3a-\x3e@\\\x7b\x7d\x85\xa0\u2028\u2029]/g;

/**
 * A pattern that vets values produced by the named directives.
 * @type RegExp
 * @private
 * @const
 */
var FILTER_FOR_FILTER_CSS_VALUE_ = /^(?!-*(?:expression|(?:moz-)?binding))(?:[.#]?-?(?:[_a-z0-9][_a-z0-9-]*)(?:-[_a-z][_a-z0-9-]*)*-?|-?(?:[0-9]+(?:\.[0-9]*)?|\.[0-9])(?:[a-z]{1,2}|%)?|!important|)$/i;

/**
 * A pattern that vets values produced by the named directives.
 * @type RegExp
 * @private
 * @const
 */
var FILTER_FOR_FILTER_NORMALIZE_URI_
    = /^(?:(?:https?|mailto):|[^&:\/?#]*(?:[\/?#]|$))/i;

/**
 * A pattern that vets values produced by the named directives.
 * @type RegExp
 * @private
 * @const
 */
var FILTER_FOR_FILTER_HTML_ATTRIBUTE_ = /^(?!style|on|action|archive|background|cite|classid|codebase|data|dsync|href|longdesc|src|usemap)(?:[a-z0-9_$:-]*|dir=(?:ltr|rtl))$/i;

/**
 * A pattern that vets values produced by the named directives.
 * @type RegExp
 * @private
 * @const
 */
var FILTER_FOR_FILTER_HTML_ELEMENT_NAME_
    = /^(?!script|style|title|textarea|xmp|no)[a-z0-9_$:-]*$/i;

/**
 * A helper for the Soy directive |escapeHtml
 * @param {*} value Can be of any type but will be coerced to a string.
 * @return {string} The escaped text.
 */
function escapeHtmlHelper(value) {
  var str = String(value);
  return str.replace(
      MATCHER_FOR_ESCAPE_HTML_,
      REPLACER_FOR_ESCAPE_HTML__AND__NORMALIZE_HTML__AND__ESCAPE_HTML_NOSPACE__AND__NORMALIZE_HTML_NOSPACE_);
}

/**
 * A helper for the Soy directive |normalizeHtml
 * @param {*} value Can be of any type but will be coerced to a string.
 * @return {string} The escaped text.
 */
function normalizeHtmlHelper(value) {
  var str = String(value);
  return str.replace(
      MATCHER_FOR_NORMALIZE_HTML_,
      REPLACER_FOR_ESCAPE_HTML__AND__NORMALIZE_HTML__AND__ESCAPE_HTML_NOSPACE__AND__NORMALIZE_HTML_NOSPACE_);
}

/**
 * A helper for the Soy directive |escapeHtmlNospace
 * @param {*} value Can be of any type but will be coerced to a string.
 * @return {string} The escaped text.
 */
function escapeHtmlNospaceHelper(value) {
  var str = String(value);
  return str.replace(
      MATCHER_FOR_ESCAPE_HTML_NOSPACE_,
      REPLACER_FOR_ESCAPE_HTML__AND__NORMALIZE_HTML__AND__ESCAPE_HTML_NOSPACE__AND__NORMALIZE_HTML_NOSPACE_);
}

/**
 * A helper for the Soy directive |normalizeHtmlNospace
 * @param {*} value Can be of any type but will be coerced to a string.
 * @return {string} The escaped text.
 */
function normalizeHtmlNospaceHelper(value) {
  var str = String(value);
  return str.replace(
      MATCHER_FOR_NORMALIZE_HTML_NOSPACE_,
      REPLACER_FOR_ESCAPE_HTML__AND__NORMALIZE_HTML__AND__ESCAPE_HTML_NOSPACE__AND__NORMALIZE_HTML_NOSPACE_);
}

/**
 * A helper for the Soy directive |escapeJsString
 * @param {*} value Can be of any type but will be coerced to a string.
 * @return {string} The escaped text.
 */
function escapeJsStringHelper(value) {
  var str = String(value);
  return str.replace(
      MATCHER_FOR_ESCAPE_JS_STRING_,
      REPLACER_FOR_ESCAPE_JS_STRING__AND__ESCAPE_JS_REGEX_);
}

/**
 * A helper for the Soy directive |escapeJsRegex
 * @param {*} value Can be of any type but will be coerced to a string.
 * @return {string} The escaped text.
 */
function escapeJsRegexHelper(value) {
  var str = String(value);
  return str.replace(
      MATCHER_FOR_ESCAPE_JS_REGEX_,
      REPLACER_FOR_ESCAPE_JS_STRING__AND__ESCAPE_JS_REGEX_);
}

/**
 * A helper for the Soy directive |escapeCssString
 * @param {*} value Can be of any type but will be coerced to a string.
 * @return {string} The escaped text.
 */
function escapeCssStringHelper(value) {
  var str = String(value);
  return str.replace(
      MATCHER_FOR_ESCAPE_CSS_STRING_,
      REPLACER_FOR_ESCAPE_CSS_STRING_);
}

/**
 * A helper for the Soy directive |filterCssValue
 * @param {*} value Can be of any type but will be coerced to a string.
 * @return {string} The escaped text.
 */
function filterCssValueHelper(value) {
  var str = String(value);
  if (!FILTER_FOR_FILTER_CSS_VALUE_.test(str)) {
    return 'zSafehtmlz';
  }
  return str;
}

/**
 * A helper for the Soy directive |filterHtmlAttribute
 * @param {*} value Can be of any type but will be coerced to a string.
 * @return {string} The escaped text.
 */
function filterHtmlAttributeHelper(value) {
  var str = String(value);
  if (!FILTER_FOR_FILTER_HTML_ATTRIBUTE_.test(str)) {
    return 'zSafehtmlz';
  }
  return str;
}

/**
 * A helper for the Soy directive |filterHtmlElementName
 * @param {*} value Can be of any type but will be coerced to a string.
 * @return {string} The escaped text.
 */
function filterHtmlElementNameHelper(value) {
  var str = String(value);
  if (!FILTER_FOR_FILTER_HTML_ELEMENT_NAME_.test(str)) {
    return 'zSafehtmlz';
  }
  return str;
}

/**
 * Matches all tags, HTML comments, and DOCTYPEs in tag soup HTML.
 *
 * @type {RegExp}
 * @private
 * @const
 */
var HTML_TAG_REGEX_ = /<(?:!|\/?[a-z])(?:[^>'"]|"[^"]*"|'[^']*')*>/gi;

// END GENERATED CODE

window["escapeHtml"] = escapeHtml;
//-*- mode: js2-mode; indent-tabs-mode: t; tab-width: 2; -*-
/*jslint evil: true, unparam: true, maxerr: 50, indent: 4 */

/**
 * Common definitions for jQuery templates and plugin passes
 * based on http://wiki.jqueryui.com/w/page/37898666/Template
 *
 * @author Mike Samuel <mikesamuel@gmail.com>
 */


/**
 * @define {boolean}
 * True if malformed templates should result in informative error messages.
 * May be turned off in production to reduce minified size.
 * When false, most of the error reporting is turned off during parsing and
 * compilation, so the production bundle should be used with templates that
 * have already passed basic sanity checks.
 */
var DEBUG = true;

/** A boolean-esque value that minifies better than true. @const */
var TRUTHY = 1;

/** A boolean-esque value that minifies better than false. @const */
var FALSEY = 0;


// JQuery Lexical Grammar.

/** Regular expression text for a snippet of HTML text. @const */
var HTML_SNIPPET_RE = (
		"(?:"
		+ "[^${]"               // A char that can't start a marker | substitution,
		+ "|\\{(?!\\{/?[=a-z])" // A curly bracket that doesn't start a marker.
		+ "|\\$(?!\\{)"         // A dollar that does not start a marker.
		+ ")+");

/** Regular expression text for a substitution.  ${...}. @const */
var SUBSTITUTION_RE = (
		"\\$\\{"
		+ "[^}]*"               // ${...} cannot contain curlies but {{=...}} can.
		+ "\\}");

/** Regular expression text for a directive name. @const */
var NAME_RE = "(?:=|[a-z][a-z0-9]*)";

/** Regular expression text for a directive start|end marker. @const */
var MARKER_RE = (
		"\\{\\{"
		+ "(?:"
		+ NAME_RE + "[\\s\\S]*?" // A start marker.
		+ "|/" + NAME_RE + "\\s*" // An end marker.
		+ ")"
		+ "\\}\\}");

/** Global regular expression that matches a single template token. */
var TOKEN = new RegExp(
		HTML_SNIPPET_RE
		+ "|" + SUBSTITUTION_RE
		+ "|" + MARKER_RE,
		"gi");

/** Regular expression text for a variable name.  @const */
// We may need to exclude keywords if these names used outside a param decl.
var VAR_NAME_RE = "[a-z_$]\\w*";

/** Matches the content of an <code>{{each}}</code> directive. @const */
var EACH_DIRECTIVE_CONTENT = new RegExp(
		"^"  // Start at the beginning,
		+ "\\s*"
		+ "(?:"  // Optional parenthetical group with var names.
			+ "\\(\\s*"
			+ "(" + VAR_NAME_RE + ")"  // Key variable name in group 1.
			+ "\\s*"
			+ "(?:"
				+ ",\\s*"
				+ "(" + VAR_NAME_RE + ")"  // Value variable name in group 2.
				+ "\\s*"
			+ ")?"
			+ "\\)\\s*"
		+ ")?"
		+ "("  // Container expression in group 3.
			+ "\\S"  // A non-space character followed by any run of non-space chars.
			+ "(?:[\\s\\S]*\\S)?"
		+ ")"
		+ "\\s*"
		+ "$",  // Finish at the end.
		"i");

/** Matches the content of a <code>{{tmpl}}</code> directive. @const */
var TMPL_DIRECTIVE_CONTENT = new RegExp(
		"^"
		+ "\\s*"
		+ "(?:"  // Optional parenthetical group with data and option exprs.
			+ "\\("
			+ "([\\s\\S]*)"  // Data and option maps go in group 1.
			+ "\\)"
			+ "\\s*"
		+ ")?"
		+ "([^\\s()](?:[^()]*[^\\s()])?)"  // Template name/selector in group 2.
		+ "\\s*"
		+ "$"
		);
/**
 * The default variable name for the key used when none is specified in an
 * <code>{{each}}</code> directive.
 */
var DEFAULT_EACH_KEY_VARIABLE_NAME = "$index";

/**
 * The default variable name used for the value when none is specified in an
 * <code>{{each}}</code> directive.
 */
var DEFAULT_EACH_VALUE_VARIABLE_NAME = "$value";


// API name constants
// These constants help us write code that is JSLint friendly, and compresses
// well with closure compiler.
/**
 * Extern property name for the member of $ that contains plugins to run.
 * @const
 */
var TEMPLATE_PLUGINS_PROP_NAME = "templatePlugins";

/** Name of the map from template names to compiled/parsed template.  @const */
var TEMPLATES_PROP_NAME = "templates";

/** Name of the extern method used to define/lookup templates.  @const */
var TEMPLATE_METHOD_NAME = "template";

/** Method of a template object that renders the template.  @const */
var TMPL_METHOD_NAME = "tmpl";

/** The default set of block directives. @const */
var DEFAULT_BLOCK_DIRECTIVES = { "each": TRUTHY, "if": TRUTHY, "wrap": TRUTHY };
//-*- mode: js2-mode; indent-tabs-mode: t; tab-width: 2; -*-

/**
 * The frontend of the JQuery template compiler
 * based on http://wiki.jqueryui.com/w/page/37898666/Template
 *
 * @author Mike Samuel <mikesamuel@gmail.com>
 */

/**
 * Guess, conservatively for well-formed templates, the set of
 * directives that require an end-marker.
 *
 * @param {string} templateText
 */
function guessBlockDirectives( templateText ) {
	var blockDirectives = {};
	// For each token like {{/foo}} put "foo" into the block directives map.
	templateText.replace(
			TOKEN,
			function ( tok ) {
				var match = tok.match( /^\{\{\/(=|[a-z][a-z0-9]*)[\s\S]*\}\}$/i );
				if ( match ) {
					blockDirectives[ match[ 1 ] ] = TRUTHY;
				}
			});
	return blockDirectives;
}

/**
 * Parse a template to a parse tree.
 * Parse trees come in two forms:
 * <ul>
 *   <li>{@code "string"} : a snippet of HTML text.</li>
 *   <li>{@code ["name", "content", ...]} where {@code "name"}
 *      is a directive name like {@code "if"} or the string {@code "="} for
 *      substitutions.  The content is the string after the name in the open
 *      marker, so for <code>{{if foo==bar}}Yes{{/if}}</code>, the content is
 *      {@code " foo==bar"}.  The "..." above is filled with child parse trees
 *      of the form described here.</li>
 * </ul>
 * <p>
 * For example, the parse tree for
 * <pre>
 * &lt;b&gt;{{if sayHello}}Hello{{else}}Goodbye{{/if}}&lt;/b&gt;, ${world}!
 * </pre>
 * is
 * <pre>
 * [
 *  "",               // Name of root is blank.
 *  "",               // Content of root is blank.
 *  "&lt;b&gt;",      // Zero-th child is a snippet of HTML.
 *  [                 // An embedded directive is an array.
 *   "if",            // Name comes first
 *   " sayHello",     // Content of {{if}}
 *   "Hello",         // A snippet of HTML.
 *   ["else", ""],    // {{else}} is an inline directive inside {{if}}.
 *   "Goodbye"
 *  ],                // End of the {{if ...}}...{{/if}}.
 *  "&lt;/b&gt;, ",   // Another snippet of HTML.
 *  ["=", "world"],   // A substitution.
 *  "!"
 * ]
 * </pre>
 *
 * @param {string} templateText The text to parse.
 * @param {Object.<number>} blockDirectives Maps directive names such as
 *     {@code "if"} to {link #TRUTHY} if they require/allow an end marker.
 * @return {Array.<string|Array>|string} A parse tree node.
 */
function parseTemplate( templateText, blockDirectives ) {
	// The root of the parse tree.
	var root = [ "", "" ],
			// A stack of nodes which have been entered but not yet exited.
			stack = [ root ],
			// The topmost element of the stack
			top = root,
      commentDepth = 0;
	$.each(
			templateText
					// Handle {#...} style non-nesting comments.
					.replace( /\{#[\s\S]*?#\}/g, "" )
					// Handle {{! ... }} style comments which can contain arbitrary nested
	        // {{...}} sections.
					.replace( /\{\{!?|\}\}|(?:[^{}]|\{(?!\{)|\}(?!}))+/g,
										function (token) {
											return token === "{{!"
													? ( ++commentDepth, "" )
													: commentDepth
													? ( token === "}}"
															? --commentDepth
															: token === "{{" && ++commentDepth,
															"" )
													: token;
										} )
					// Match against a global regexp to pull out all tokens.
					.match( TOKEN ) || [],
			function ( _, token ) {
				var m = token.match( /^\{\{(\/?)(=|[a-z][a-z0-9]*)([\s\S]*)\}\}$/i );
				if ( m ) {  // A marker.
					// "/" in group 1 if a close.  Name in group 2.  Content in group 3.
					if ( m[ 1 ] ) {  // An end marker
						if ( DEBUG && top[ 0 ] !== m[ 2 ] ) {
							throw new Error( "Misplaced " + token + " in " + templateText );
						}
						top = stack[ --stack.length - 1 ];
					} else {  // A start marker.
						var node = [ m[ 2 ], m[ 3 ] ];
						if ( DEBUG ) {
							if ( m[ 2 ] === "=" ) {
								try {
									// For some reason, on Safari,
									//     Function("(i + (j)")
									// fails with a SyntaxError as expected, but
									//     Function("return (i + (j)")
									// does not.
									// Filed as https://bugs.webkit.org/show_bug.cgi?id=59795
									Function( "(" + m[ 3 ] + ")" );
								} catch ( e1 ) {
									throw new Error( "Invalid template substitution: " + m[ 3 ] );
								}
							} else if ( m[ 2 ] === "tmpl" ) {
								var tmplContent = m[ 3 ].match( TMPL_DIRECTIVE_CONTENT );
								try {
									Function( "([" + tmplContent[ 1 ] + "])" );
									Function( "(" + tmplContent[ 2 ] + ")" );
								} catch ( e2 ) {
									throw new Error(
											"Invalid {{" + m[2] + "}} content: " + m[ 3 ] );
								}
							}
						}
						top.push( node );
						if ( blockDirectives[ m[ 2 ] ] === TRUTHY ) {
							stack.push( top = node );
						}
					}
				} else if ( token.substring( 0, 2 ) === "${" ) {  // A substitution.
					top.push( [ "=", token.substring( 2, token.length - 1 ) ] );
					if ( DEBUG ) {
						var content = top[ top.length - 1 ][ 1 ];
						try {
							// See notes on {{=...}} sanity check above.
							Function( "(" + content + ")" );
						} catch ( e2 ) {
							throw new Error( "Invalid template substitution: " + content );
						}
					}
				} else {  // An HTML snippet.
					top.push( token );
				}
			});
	if ( DEBUG && stack.length > 1 ) {
		throw new Error(
				"Unclosed block directives "
				+ stack.slice( 1 ).map( function ( x ) { return x[ 0 ]; } ) + " in "
				+ templateText );
	}
	return root;
}


// Utilities for debugging parser plugins.

/**
 * Given a template parse tree, returns source text that would parse to that
 * parse tree.  This can be useful for debugging but not required.
 *
 * @param {Array.<string|Array>|string} parseTree as produced by
 *     {@link #parseTemplate}.
 * @param {Object.<Number>} opt_blockDirectives.
 */
function renderParseTree( parseTree, opt_blockDirectives ) {
	var buffer = [];
	( function render( _, parseTree ) {
		 if ( typeof parseTree === "string" ) {
			 buffer.push( parseTree );
		 } else {
			 var name = parseTree[ 0 ], n = parseTree.length;
			 buffer.push( "{{", name, parseTree[ 1 ], "}}" );
			 $.each( parseTree.slice( 2 ), render );
			 if ( n !== 2 || !opt_blockDirectives
					  || opt_blockDirectives[ name ] === TRUTHY ) {
				 buffer.push( "{{/", name, "}}" );
			 }
		 }
	 }( 2, parseTree ) );
	return buffer.join( "" );
}
//-*- mode: js2-mode; indent-tabs-mode: t; tab-width: 2; -*-

/**
 * An efficient backend for the JQuery template compiler
 * based on http://wiki.jqueryui.com/w/page/37898666/Template
 *
 * @author Mike Samuel <mikesamuel@gmail.com>
 */

function compileToFunction( parseTree ) {
	var TEMP_NAME_PREFIX = "$$tmplVar";
	var javaScriptSource = [
			"var " + TEMP_NAME_PREFIX + "0;"
			// Make available on the stack, the enumerable properties of the data
			// object, and the enumerable properties of the options object.
			// Data properties should trump options.
			+ "$data=$.extend("
			// Where EcmaScript 5's Object.create is available, use that to prevent
			// Object.prototype properties from masking globals.
			+ "Object.create?Object.create(null):{},"
			// We don't use parameter names to, again, avoid masking properties of
			// the global object.
			+ "$data||{});"
			// Make the options object available
			+ "$item=$item||{};"
			+ "with($data){"
			// The below compiles the parse tree to an expression that returns a
			// string.
			+ "return("];
  var inScope = [];  // Used to propagate variables in scope through {{tmpl}}.
	var hasValue;
	var nestLevel = 0;
	$.each(
			parseTree.slice( 2 ),
			function walk( _, parseTree ) {
				// If there was a value before this one, append them.
				if ( hasValue ) {
					javaScriptSource.push( "+" );
				}
				var match;
				if ( typeof parseTree === "string") {  // HTML snippet
					// 'foo' -> "\'foo\'"
					javaScriptSource.push( escapeJsValue( parseTree ) );
				} else {
					var kind = parseTree[ 0 ], content = parseTree[ 1 ],
							len = parseTree.length;
					var tmpName = TEMP_NAME_PREFIX + nestLevel;
					if ( kind === "=" ) {  // ${...} substitution.
						// Make sure that + is string-wise.
						// Specifically, ${1}${2} should not compile to (1 + 2).
						if ( !hasValue ) {
							javaScriptSource.push( "''+" );
						}
						// ${x} -> (tmp0 = (x), 'function' !== typeof tmp0 ? tmp0 : tmp0())
						// The above is often the same as
						// ${x} -> (x)
						// but the real story is more complicated since we have to
						// de-thunkify the expression; if it is a function, we need to
						// call it.
						// By using the temporary value, we are guaranteed to only
						// evaluate the expression once.  This avoids problems with
						// expressions like (arr[i++]) which might return a function
						// the first time but not the second.
						var wrapperStart = "", wrapperEnd = "";
						content = content.replace(
								/(=>\w+)+$/, function ( postDethunk ) {
									postDethunk = postDethunk.split( "=>" );
									wrapperEnd = new Array( postDethunk.length ).join( ")" );
									wrapperStart = postDethunk.reverse().join( "(" );
									return "";
								});
						// To make it easy for passes to rewrite expressions without
						// preventing thunking we convert syntax like
						// "x=>a=>b" into "a(b(x))"
						javaScriptSource.push(
								"(", tmpName, "=(", content, "),",
								wrapperStart,
								"'function'!==typeof ",
								tmpName, "?", tmpName, ":", tmpName, ".call(null,arguments))",
								wrapperEnd );
					} else if ( kind === "if" ) {  // {{if condition}}...{{/if}}
						// {{if a}}b{{else}}c{{/if}} -> (a ? "b" : "c")
						hasValue = TRUTHY;
						var pos = 2, elseIndex, i;
						for ( ; true; pos = elseIndex + 1 ) {
							elseIndex = len;
							for ( i = pos; i < elseIndex; ++i ) {
								if ( parseTree[ i ][ 0 ] === "else" ) {
									elseIndex = i;
								}
							}
							var cond = pos < len
									? ( pos === 2 ? parseTree : parseTree[ pos - 1 ] )[ 1 ] : "";
							var continues = /\S/.test( cond );
							if ( DEBUG && !continues ) {
								if ( pos === 2 ) {
									throw new Error(
											"{{if}} missing condition:"
											+ renderParseTree( parseTree, {} ) );
								} else if ( elseIndex !== len ) {
									throw new Error(
											"{{else}} without condition must be last:"
											+ renderParseTree( parseTree, {} ) );
								}
							}
							// The below handles several cases (assuming we wouldn't have
							// thrown an exception above if DEBUG were true):
							//   pos === 2 && continues  ; {{if cond}}
							//      => ((cond)?(<code-up-to-else-or-end>)
							//   pos > 2 && continues    ; {{else cond}}
							//      => ):((cond)?(<code-up-to-else-or-end)
							//   pos > 2 && !continues   ; {{else}} implicit or othersise
							//      => ):((<code-up-to-else-or-end)
							javaScriptSource.push(
									hasValue ? "" : "''",
									pos === 2 ? "((" : "):(",
									cond, continues ? ")?(" : "" );
							hasValue = FALSEY;
							$.each( parseTree.slice( pos, elseIndex ), walk );
							if ( !continues ) {
								break;
							}
						}
						javaScriptSource.push( hasValue ? "))" : "''))" );
					// {{each (key, value) obj}}...{{/each}}
					} else if ( kind === "each" ) {
						// {{each (k, v) ["one", "two"]}}<li value=${k + 1}>${v}{{/each}}
						// -> (tmp0 = [],
						//     $.each(["one", "two"],
						//     function (k, v) {
						//       tmp0.push("<li value=" + (k + 1) + ">" + v + "</li>");
						//     }),
						//     tmp0.join(""))
						// The first part of the comma operator creates a buffer.
						// Then $.each is called to properly iterate over the container.
						// Each iteration puts a string onto the array.
						// Then after iteration is complete, the last element of the comma
						// operator joins the array.  That joined array is the result of
						// the compiled each operator.
						match = content.match( EACH_DIRECTIVE_CONTENT );
						if ( DEBUG && !match ) {
							throw new Error( 'Malformed {{each}} content: ' + content );
						}
						var keyVar = match[ 1 ] || DEFAULT_EACH_KEY_VARIABLE_NAME,
								valueVar = match[ 2 ] || DEFAULT_EACH_VALUE_VARIABLE_NAME;
						var containerExpr = match[ 3 ];
						++nestLevel;
						javaScriptSource.push(
								"(", tmpName, "=[],$.each((", containerExpr,
								"),function(", keyVar, ",", valueVar, "){var ",
								TEMP_NAME_PREFIX, nestLevel, ";", tmpName, ".push(");
						hasValue = FALSEY;
						inScope.push( keyVar + ":" + keyVar, valueVar + ":" + valueVar );
						$.each( parseTree.slice( 2 ), walk );
						inScope.length -= 2;
						if ( !hasValue ) {
							javaScriptSource.push( "''" );
						}
						javaScriptSource.push( ")}),", tmpName, ".join(''))" );
						--nestLevel;
					} else if ( kind === "tmpl" ) {
						// {{tmpl name}}
						//    -> $.template("name").tmpl(arguments[0], arguments[1])
						// {{tmpl #id}}
						//    -> $.template($("#id")).tmpl(arguments[0], arguments[1])
						// {{tmpl({x: y}) foo}}
						//    -> $.template("foo").tmpl({ x: y }, arguments[1])
						// {{tmpl({x: y}, { z: w }) foo}}
						//    -> $.template("foo").tmpl({ x: y }, { z: w })
						// The above is correct in spirit if not literally.  See below.

						match = content.match( TMPL_DIRECTIVE_CONTENT );
						if ( DEBUG && !match ) {
							throw new Error( 'Malformed {{tmpl}} content: ' + content );
						}
						// The data and options come separated by a comma.
						// Parsing JavaScript expressions to figure out where a comma
						// separates two things is hard, so we use a trick.
						// We create an array that we can index into.  The comma that
						// separates the data from the options then simply becomes a
						// comma in an array constructor.
						var dataAndOptions = match[ 1 ];
						javaScriptSource.push(
								"(", tmpName, "=",
								dataAndOptions
								// The below uses arguments[0], the data passed to the compiled
								// function if dataAndOptions is ", { a: b }".
								// It also uses arguments[1], the options passed to the
								// compiled function if dataAndOptions has no options:
								// "{ a: b }".
								// Note also that dataAndOptions is evaluated before any
								// template selector is resolved as expected from the ordering
								// of those in the content.
								? "$.extend([],arguments,[" + dataAndOptions + "])"
							  // Propagate any loop variables in scope when all data is
							  // passed.
								: inScope.length
								? "[$.extend({},$data,{" + inScope + "}),$item]"
								// If the content specifies neither data nor options, and
								// no loop vars are in scope, use the arguments without the
								// overhead of a call to $.extend.
								: "arguments",
								",$.template((",
								match[ 2 ],
								")).tmpl(", tmpName, "[0],", tmpName, "[1]))");

					// {html} and {wrap} are handled by translation to ${...} and ${tmpl}
					// respectively.
					} else {
						if ( DEBUG ) {
							throw new Error(
									"I do not know how to compile "
									+ renderParseTree( parseTree, DEFAULT_BLOCK_DIRECTIVES ) );
						}
					}
				}
				hasValue = TRUTHY;
			});
	if ( !hasValue ) {
		javaScriptSource.push( "''" );
	}
	javaScriptSource.push( ")}");
	try {
		return Function( "$data", "$item", javaScriptSource.join( "" ) );
	} catch ( ex ) {
		throw DEBUG ? new Error( javaScriptSource.join( "" ) ) : ex;
	}
}
//-*- mode: js2-mode; indent-tabs-mode: t; tab-width: 2; -*-

/**
 * API methods and builtin compiler passes for JQuery templates
 * based on http://wiki.jqueryui.com/w/page/37898666/Template
 *
 * @author Mike Samuel <mikesamuel@gmail.com>
 */

/**
 * An array of plugin passed, functions that take a parse tree and return
 * a parse tree, to run beore compilation.
 */
$[ TEMPLATE_PLUGINS_PROP_NAME ] = [
	// Naive auto-escape.
	function autoescape( parseTrees ) {
		$.each(
				parseTrees,
				function autoescapeOne( _, parseTree ) {
					if ( typeof parseTree !== "string" ) {
						if ( parseTree[ 0 ] === "=" ) {
							parseTree[ 1 ] += "=>escapeHtml";
						} else if ( parseTree[ 0 ] === "html" ) {
							parseTree[ 0 ] = "=";
						} else {
							$.each( parseTree, autoescapeOne );
						}
					}
				});
		return parseTrees;
	}
];

function needsCompile( name ) {
	var tmpl = $[ TEMPLATES_PROP_NAME ][ name ];
	return tmpl && "function" !== typeof tmpl[ TMPL_METHOD_NAME ];
}

function compileBundle( parseTrees, opt_exclusion ) {
	var processedNames = {};
	$.each( parseTrees, function process( name, parseTree ) {
		if ( processedNames[ name ] !== TRUTHY ) {
			processedNames[ name ] = TRUTHY;
			$.each( parseTree, function findDeps( _, node ) {
				if ( node[ 0 ] === "tmpl" || node[ 0 ] === "wrap" ) {
					var match = node[ 1 ].match( TMPL_DIRECTIVE_CONTENT );
					if ( match ) {
						var depName = match[ 2 ];
						if ( needsCompile( depName )
								&& processedNames[ depName ] !== TRUTHY ) {
							process(
									depName,
									parseTrees[ depName ] = $[ TEMPLATES_PROP_NAME ][ depName ] );
						}
					}
				}
			});
		}
	});
	function makePrepassCaller( pluginIndex ) {
		return function ( parseTrees ) {
			var i;
			for ( i = 0; i < pluginIndex; ++i ) {
				parseTrees = $[ TEMPLATE_PLUGINS_PROP_NAME ][ i ](
						parseTrees, makePrepassCaller( i ) );
			}
			return parseTrees;
		};
	}
	var result;
	$.each( makePrepassCaller(
						$[ TEMPLATE_PLUGINS_PROP_NAME ].length )( parseTrees ),
					function ( templateName, parseTree ) {
						var tmplObj = { "tmpl": compileToFunction( parseTree ) };
						if ( templateName !== opt_exclusion ) {
							$[ TEMPLATES_PROP_NAME ][ templateName ] = tmplObj;
						} else {
							result = tmplObj;
						}
					});
	return result;
}

$[ TEMPLATES_PROP_NAME ] = {};

$[ TEMPLATE_METHOD_NAME ] = function self( name, templateSource ) {
	var t = $[ TEMPLATES_PROP_NAME ];
	var parseTrees;
	if ( arguments.length === 1 ) {
		if ( name.indexOf( "<" ) + 1 ) {
			return self( null, name );
		}
		if ( needsCompile( name ) ) {
			parseTrees = {};
			parseTrees[ name ] = t[ name ];
			compileBundle( parseTrees );
		}
		return t[ name ];
	}
	// We delay compiling until we've got a bunch of definitions together.
	// This allows plugins to process entire template graphs.
	var parseTree = parseTemplate(
			templateSource,
			$.extend( guessBlockDirectives( templateSource ),
							  DEFAULT_BLOCK_DIRECTIVES ) );
	if ( name === null ) {
		return compileBundle( parseTrees = { "_": parseTree }, "_" );
	}
	t[ name ] = parseTree;
};
 })()
