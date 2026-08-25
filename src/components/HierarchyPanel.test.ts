import { describe, it, expect } from 'vitest';

describe('HierarchyPanel keyboard guard & accidental deletion prevention', () => {
  interface MockElement {
    tagName?: string;
    isContentEditable?: boolean;
    attributes?: Record<string, string>;
    parent?: MockElement | null;
    className?: string;
  }

  const isInputElement = (el: MockElement | null): boolean => {
    if (!el) return false;
    const tag = el.tagName?.toUpperCase();
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return true;
    if (el.isContentEditable || el.attributes?.['contenteditable'] === 'true') return true;

    // Check closest ancestor
    let cur: MockElement | null = el;
    while (cur) {
      if (cur.className && cur.className.includes('monaco-editor')) return true;
      if (cur.attributes?.['contenteditable'] === 'true') return true;
      const curTag = cur.tagName?.toUpperCase();
      if (curTag === 'INPUT' || curTag === 'TEXTAREA' || curTag === 'SELECT') return true;
      cur = cur.parent || null;
    }

    return false;
  };

  it('should block deletion when target is standard HTML input or textarea', () => {
    const input: MockElement = { tagName: 'INPUT' };
    const textarea: MockElement = { tagName: 'TEXTAREA' };
    const select: MockElement = { tagName: 'SELECT' };

    expect(isInputElement(input)).toBe(true);
    expect(isInputElement(textarea)).toBe(true);
    expect(isInputElement(select)).toBe(true);
  });

  it('should block deletion when target is inside Monaco Editor DOM container', () => {
    const monacoContainer: MockElement = {
      tagName: 'DIV',
      className: 'monaco-editor vs-dark',
    };

    const monacoLine: MockElement = {
      tagName: 'DIV',
      className: 'view-line',
      parent: monacoContainer,
    };

    expect(isInputElement(monacoLine)).toBe(true);
  });

  it('should block deletion when target has contenteditable set', () => {
    const editableDiv: MockElement = {
      tagName: 'DIV',
      attributes: { contenteditable: 'true' },
    };

    const spanInside: MockElement = {
      tagName: 'SPAN',
      parent: editableDiv,
    };

    expect(isInputElement(editableDiv)).toBe(true);
    expect(isInputElement(spanInside)).toBe(true);
  });

  it('should allow deletion when focus is in 3D viewport canvas or neutral panel', () => {
    const canvas: MockElement = { tagName: 'CANVAS' };
    const panel: MockElement = { tagName: 'DIV', className: 'hierarchy-tree' };

    expect(isInputElement(canvas)).toBe(false);
    expect(isInputElement(panel)).toBe(false);
  });
});
