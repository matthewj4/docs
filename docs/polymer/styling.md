---
layout: default
title: Styling reference
---

{% include toc.html %}

**Note:** styling {{site.project_title}} elements is no different than styling custom elements.
For a complete guide on the basics, see "[A Guide to Styling Elements](/articles/styling-elements.html)".
{: .alert }

In addition to the [standard features for styling Custom Elements](/articles/styling-elements.html), {{site.project_title}} contains extra goodies for fully controlling element styling. This document outlines those features, including FOUC prevention, the specifics on how the the Shadow DOM polyfill applies styles, and workarounds for current limitations.

## FOUC prevention

Before custom elements [upgrade](http://www.html5rocks.com/en/tutorials/webcomponents/customelements/#upgrades) they may display incorrectly. To help mitigate these styling issues, {{site.project_title}} provides the `polymer-veiled` and `polymer-unveil` classes for preventing [FOUC](http://en.wikipedia.org/wiki/Flash_of_unstyled_content).

To initially hide an element, include the `polymer-veiled` class:

    <x-foo class="polymer-veiled">If you see me, elements are upgraded!</x-foo>
    <div class="polymer-veiled"></div>

Alternatively, you can add selectors to `Polymer.veiledElements`. Elements included in
this array will automatically get the `polymer-veiled` class applied to them at boot time:

    Polymer.veiledElements = ['x-foo', 'div'];

Class name | Behavior when applied to an element
|-
`polymer-veiled` | Makes the element `opacity: 0`.
`polymer-unveil` | Fades-in the element to `opacity: 1`.
{: .table }

### Overriding the default behavior {#overriding}

By default, `body` is included in the `Polymer.veiledElements` array. When [`WebComponentsReady`](/polymer.html#WebComponentsReady) fires, {{site.project_title}} removes the `polymer-veiled` class and adds `polymer-unveil` at the first `transitionend` event the element receives.  To override this behavior (and therefore prevent the entire page from being initially hidden), set `Polymer.veiledElements` to null:
    
    Polymer.veiledElements = null;

### Unveiling elements after boot time {#unveilafterboot}

The veiling process can be used to prevent FOUC at times other than page load. To do so, apply the `polymer-veiled` class to the desired elements and call `Polymer.unveilElements()` when they should be displayed. For example,

    element.classList.add('polymer-veiled');
    // ... some time late ...
    Polymer.unveilElements();

## Polyfill styling directives

When running {{site.project_title}} under the polyfill, the `@polyfill-*`
directives give you more control for how {{site.project_title}} performs Shadow DOM styling.

### @polyfill {#at-polyfill}

The `@polyfill` directive is used to replace a native CSS selector with one that
will work under the polyfill. For example, targeting distributed nodes using `::content` only works under native Shadow DOM. Instead, you can tell {{site.project_title}} to replace said
rules with ones compatible with the polyfill.

To replace native rules, place `@polyfill` inside a CSS comment above the 
style rule you want to replace. The string next to `"@polyfill"` indicates a
CSS selector to replace the next style rule with. For example:

    /* @polyfill @host .bar */
    ::content .bar {
      color: red;
    }

    /* @polyfill .container > * */
    ::content > * {
      border: 1px solid black;
    }

Under native Shadow DOM nothing changes. Under the polyfill the native selector 
s replaced with the one in the `@polyfill` comment above it:

    x-foo .bar {
      color: red:
    }

    .container > * {
      border: 1px solid black;
    }

### @polyfill-rule {#at-polyfill-rule}

The `@polyfill-rule` directive is used to create a style rule that should apply *only* when the Shadow DOM polyfill is in use. It's a useful catch-all when it's not possible to write a rule that can automatically morph between native Shadow DOM and polyfill Shadow DOM. Because of the simulated styling {{site.project_title}} provides, you should rarely need to use this directive.

To create a rule that only applies under the polyfill, place the `@polyfill-rule` directive entirely inside a CSS comment:

    /* @polyfill-rule .foo {
      background: red;
    } */

This has no effect under native Shadow DOM but under the polyfill, the comment is removed.
No automated scoping is performed on `@polyfill-rule` rules but `@host` will get
replaced with the custom element name:

    /* @polyfill-rule @host.yellow {
      background: yellow;
    } */

### @polyfill-unscoped-rule {#at-polyfill-unscoped-rule}

## Making styles global

`<link polymer-scope="element?">`?????

Sometimes you need globals.

According to spec, certain CSS @-rules like `@keyframe` and `@font-face`
cannot be defined in a `<style scoped>`. Therefore, you need to either declare
their definitions outside the element or make them global using the
`polymer-scope="global"` attribute.

**Example:** making a stylesheet global

    <polymer-element name="x-foo">
      <template>
        <link rel="stylesheet" href="fonts.css" polymer-scope="global">
        ...
      </template>
      <script>Polymer('x-foo');</script>
    </polymer-element>

A stylesheet or `<style>` that uses the `polymer-scope="global"` attribute
is moved to the `<head>` of the main page. This happens once, and you can safely
use it wherever you need it.

**Example:** Define and use CSS animations in an element

    <polymer-element name="x-blink">
      <template>
        <style polymer-scope="global">
          @-webkit-keyframes blink {
            to { opacity: 0; }
          }
        </style>
        <style>
          @host {
            :scope {
              -webkit-animation: blink 1s cubic-bezier(1.0,0,0,1.0) infinite 1s;
            }
          }
        </style>
        ...
      </template>
      <script>Polymer('x-blink');</script>
    </polymer-element>

**Note:** `polymer-scope="global"` should only be used for stylesheets or `<style>`
that contain rules which need to be in the global scope (e.g. `@keyframe` and `@font-face`).
{: .alert .alert-error}

## Polyfill details

### Handling scoped styles

Native Shadow DOM gives us style encapsulation for free via scoped styles. For browsers
that lack native support, {{site.project_title}}'s polyfills attempt to shim _some_
of the scoping behavior.

Because polyfilling the styling behaviors of Shadow DOM is difficult, {{site.project_title}}
has opted to favor practicality and performance over correctness. For example,
the polyfill's do not protect Shadow DOM elements against document level CSS.
 
When {{site.project_title}} processes element definitions, it looks for `<style>` elements
and stylesheets. It removes these from the custom element's Shadow DOM `<template>`
and re-formulates them according to the rules below. Once this is done, a `<style>`
element is added to the main document with the reformulated rules.

#### Reformatting rules

1. **Convert rules inside `@host` to rules prefixed with the element's tag name**

      For example, this rule inside an `x-foo`:

        <polymer-element name="x-foo">
          <template>
            <style>
              @host {
                :scope { ... }
                :scope:hover { ... }
              }
            </style>
          ...

      becomes:

        <polymer-element name="x-foo">
          <template>
            <style>
              x-foo { ... }
              x-foo:hover { ... }
            </style>
          ...

1. **Prepend selectors with the element name, creating a descendent selector**.
This ensures styling does not leak outside the element's shadowRoot (e.g. upper bound encapsulation).

      For example, this rule inside an `x-foo`:

        <polymer-element name="x-foo">
          <template>
            <style>
              div { ... }
            </style>
          ...

      becomes:

        <polymer-element name="x-foo">
          <template>
            <style>
              x-foo div { ... }
            </style>
          ...

      Note, this technique does not enforce lower bound encapsulation. For that,
      you need to set `Platform.ShadowCSS.strictStyling = true`. This isn't the
      yet the default because it requires that you add the custom element's
      name as an attribute on all DOM nodes in the shadowRoot (e.g. `<span x-foo>`).

### Forcing strict styling

`Platform.ShadowCSS.strictStyling = true`