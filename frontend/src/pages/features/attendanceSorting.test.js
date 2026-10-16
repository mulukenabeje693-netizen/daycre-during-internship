import test from 'node:test';
import assert from 'node:assert/strict';
import { sortAttendanceChildren } from './attendanceSorting.js';

const children = [
  { _id: 'c', firstName: 'Casey', lastName: 'Young', dateOfBirth: '2023-04-01', createdAt: '2025-02-01' },
  { _id: 'a', firstName: 'Alex', lastName: 'Older', dateOfBirth: '2020-01-01', createdAt: '2024-01-01' },
  { _id: 'b', firstName: 'Bailey', lastName: 'Middle', dateOfBirth: '2022-06-01', createdAt: '2025-01-01' }
];

test('sorts attendance children alphabetically in both directions', () => {
  assert.deepEqual(sortAttendanceChildren(children, 'nameAsc').map(child => child._id), ['a', 'b', 'c']);
  assert.deepEqual(sortAttendanceChildren(children, 'nameDesc').map(child => child._id), ['c', 'b', 'a']);
});

test('sorts youngest and oldest by date of birth', () => {
  assert.deepEqual(sortAttendanceChildren(children, 'yearYoungest').map(child => child._id), ['c', 'b', 'a']);
  assert.deepEqual(sortAttendanceChildren(children, 'yearOldest').map(child => child._id), ['a', 'b', 'c']);
});

test('sorts newest and oldest by registration date', () => {
  assert.deepEqual(sortAttendanceChildren(children, 'dateNewest').map(child => child._id), ['c', 'b', 'a']);
  assert.deepEqual(sortAttendanceChildren(children, 'dateOldest').map(child => child._id), ['a', 'b', 'c']);
});

test('safely puts missing or invalid dates after dated children', () => {
  const incomplete = [
    { _id: 'valid', firstName: 'A', dateOfBirth: '2022-01-01', createdAt: '2024-01-01' },
    { _id: 'missing', firstName: 'B' },
    { _id: 'invalid', firstName: 'C', dateOfBirth: 'invalid', createdAt: 'invalid' }
  ];

  assert.deepEqual(sortAttendanceChildren(incomplete, 'yearYoungest').map(child => child._id), ['valid', 'missing', 'invalid']);
  assert.deepEqual(sortAttendanceChildren(incomplete, 'dateNewest').map(child => child._id), ['valid', 'missing', 'invalid']);
});

test('does not mutate the input list', () => {
  const input = [...children];
  sortAttendanceChildren(input, 'nameAsc');
  assert.deepEqual(input, children);
});
