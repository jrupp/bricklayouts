import { getOptionIndexByValue, isApproxMultiple } from '../../src/utils/utils.js';

describe('isApproxMultiple', () => {
  it('returns true for exact integer multiples', () => {
    expect(isApproxMultiple(10, 5)).toBeTrue();
    expect(isApproxMultiple(-10, 5)).toBeTrue();
    expect(isApproxMultiple(10, -5)).toBeTrue();
    expect(isApproxMultiple(0, 5)).toBeTrue();
  });

  it('returns false for non-multiples', () => {
    expect(isApproxMultiple(10, 3)).toBeFalse();
    expect(isApproxMultiple(-10, 3)).toBeFalse();
    expect(isApproxMultiple(10, -3)).toBeFalse();
  });

  it('handles floating point rounding issues (within default eps)', () => {
    expect(isApproxMultiple(0.3, 0.1)).toBeTrue();
    expect(isApproxMultiple(614.4, 51.2)).toBeTrue(); // from the doc comment
  });

  it('respects the provided epsilon threshold', () => {
    // Inside tolerance with default eps (1e-6)
    expect(isApproxMultiple(2.0000007, 1)).toBeTrue();

    // Outside a tighter tolerance
    expect(isApproxMultiple(2.0000007, 1, 5e-7)).toBeFalse();

    // With eps = 0, even exact multiples are not accepted (strict < eps)
    expect(isApproxMultiple(10, 5, 0)).toBeFalse();
  });

  it('returns false for zero step', () => {
    expect(isApproxMultiple(10, 0)).toBeFalse();
    expect(isApproxMultiple(0, 0)).toBeFalse();
  });

  it('returns false for non-finite inputs', () => {
    expect(isApproxMultiple(NaN, 5)).toBeFalse();
    expect(isApproxMultiple(10, NaN)).toBeFalse();
    expect(isApproxMultiple(Infinity, 5)).toBeFalse();
    expect(isApproxMultiple(10, Infinity)).toBeFalse();
    expect(isApproxMultiple(-Infinity, 5)).toBeFalse();
    expect(isApproxMultiple(10, -Infinity)).toBeFalse();
  });

  it('handles large values correctly', () => {
    expect(isApproxMultiple(1e15, 1)).toBeTrue();
    expect(isApproxMultiple(1e15 + 0.5, 1)).toBeFalse();
  });
});

describe('getOptionIndexByValue', () => {
  const createSelect = (id, options = []) => {
    const select = document.createElement('select');
    select.id = id;
    options.forEach(v => {
      const opt = document.createElement('option');
      opt.value = v;
      opt.textContent = v;
      select.appendChild(opt);
    });
    document.body.appendChild(select);
    return select;
  };

  const removeElementById = (id) => {
    const el = document.getElementById(id);
    if (el && el.parentNode) el.parentNode.removeChild(el);
  };

  it('returns the index of the matching option value', () => {
    const id = 'test-select-1';
    createSelect(id, ['a', 'b', 'c']);

    expect(getOptionIndexByValue(id, 'a')).toBe(0);
    expect(getOptionIndexByValue(id, 'b')).toBe(1);
    expect(getOptionIndexByValue(id, 'c')).toBe(2);

    removeElementById(id);
  });

  it('returns default (-1) when the value is not present', () => {
    const id = 'test-select-2';
    createSelect(id, ['x', 'y']);

    expect(getOptionIndexByValue(id, 'z')).toBe(-1);

    removeElementById(id);
  });

  it('returns provided default when the value is not present', () => {
    const id = 'test-select-3';
    createSelect(id, ['x', 'y']);

    expect(getOptionIndexByValue(id, 'z', 42)).toBe(42);

    removeElementById(id);
  });

  it('warns and returns default when the select element is not found', () => {
    const warnSpy = spyOn(console, 'warn');
    const result = getOptionIndexByValue('no-such-id', 'any', 7);

    expect(result).toBe(7);
    expect(warnSpy).toHaveBeenCalled();
  });

  it('returns default for an empty select', () => {
    const id = 'test-select-4';
    createSelect(id, []);

    expect(getOptionIndexByValue(id, 'anything', 9)).toBe(9);

    removeElementById(id);
  });

  it('returns the first matching index when duplicate values exist', () => {
    const id = 'test-select-5';
    createSelect(id, ['dup', 'mid', 'dup']);

    expect(getOptionIndexByValue(id, 'dup')).toBe(0);

    removeElementById(id);
  });

  it('matches by strict string equality (no coercion)', () => {
    const id = 'test-select-6';
    createSelect(id, ['2']);

    // Number 2 is not strictly equal to '2'
    expect(getOptionIndexByValue(id, 2, -99)).toBe(-99);
    // String '2' matches
    expect(getOptionIndexByValue(id, '2')).toBe(0);

    removeElementById(id);
  });
});