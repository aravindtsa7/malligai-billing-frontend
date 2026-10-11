import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import type { UnitOfMeasure } from '../types/unit.types.ts';
import UnitMasterPage from './UnitMasterPage.tsx';

const mocks = vi.hoisted(() => ({
  listUnits: vi.fn(),
  getUnitById: vi.fn(),
  createUnit: vi.fn(),
  updateUnit: vi.fn(),
  updateUnitStatus: vi.fn(),
}));

vi.mock('../api/unit.api.ts', () => ({
  unitApi: {
    listUnits: mocks.listUnits,
    getUnitById: mocks.getUnitById,
    createUnit: mocks.createUnit,
    updateUnit: mocks.updateUnit,
    updateUnitStatus: mocks.updateUnitStatus,
  },
}));

vi.mock('../api/api-client.ts', () => ({
  getApiErrorMessage: (error: unknown, fallback = 'error') =>
    error instanceof Error ? error.message : fallback,
}));

const mockUnits: UnitOfMeasure[] = [
  {
    id: 1,
    name: 'Kilogram',
    shortName: 'kg',
    active: true,
    createdAt: '2026-09-01T00:00:00.000Z',
    updatedAt: '2026-09-01T00:00:00.000Z',
  },
  {
    id: 2,
    name: 'Litre',
    shortName: 'L',
    active: true,
    createdAt: '2026-09-01T00:00:00.000Z',
    updatedAt: '2026-09-01T00:00:00.000Z',
  },
  {
    id: 3,
    name: 'Box',
    shortName: 'box',
    active: false,
    createdAt: '2026-09-01T00:00:00.000Z',
    updatedAt: '2026-09-01T00:00:00.000Z',
  },
];

describe('UnitMasterPage Suite', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.listUnits.mockResolvedValue([...mockUnits]);
  });

  afterEach(() => {
    cleanup();
  });

  it('renders unit table with units, columns, and NO delete button', async () => {
    render(
      <MemoryRouter>
        <UnitMasterPage />
      </MemoryRouter>
    );

    expect(await screen.findByText('Unit of Measure')).toBeInTheDocument();
    expect(screen.getByText('Kilogram')).toBeInTheDocument();
    expect(screen.getByText('kg')).toBeInTheDocument();
    expect(screen.getByText('Litre')).toBeInTheDocument();
    expect(screen.getByText('L')).toBeInTheDocument();
    expect(screen.getByText('Box')).toBeInTheDocument();
    expect(screen.getByText('box')).toBeInTheDocument();

    // Verify Active / Inactive status badges
    const activeBadges = screen.getAllByText('ACTIVE');
    expect(activeBadges.length).toBe(2);
    expect(screen.getByText('INACTIVE')).toBeInTheDocument();

    // Crucial rule: NO physical DELETE button anywhere
    expect(screen.queryByText(/delete/i)).not.toBeInTheDocument();
  });

  it('creates a new unit of measure via Add Unit modal', async () => {
    const newUnit: UnitOfMeasure = {
      id: 4,
      name: 'Millilitre',
      shortName: 'ml',
      active: true,
      createdAt: '2026-09-23T00:00:00.000Z',
      updatedAt: '2026-09-23T00:00:00.000Z',
    };
    mocks.createUnit.mockResolvedValue(newUnit);

    render(
      <MemoryRouter>
        <UnitMasterPage />
      </MemoryRouter>
    );

    await screen.findByText('Kilogram');

    // Click "+ Add Unit"
    const addBtn = screen.getByRole('button', { name: /\+ Add Unit/i });
    fireEvent.click(addBtn);

    // Modal opens
    expect(screen.getByText('Add Unit of Measure')).toBeInTheDocument();

    // Try submitting empty -> validation errors
    const submitBtn = screen.getByRole('button', { name: /Create Unit/i });
    fireEvent.click(submitBtn);

    expect(await screen.findByText(/Unit Name is required/i)).toBeInTheDocument();
    expect(screen.getByText(/Short Name is required/i)).toBeInTheDocument();

    // Fill valid values
    fireEvent.change(screen.getByLabelText(/Unit Name/i), { target: { value: 'Millilitre' } });
    fireEvent.change(screen.getByLabelText(/Short Name/i), { target: { value: 'ml' } });

    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(mocks.createUnit).toHaveBeenCalledWith({
        name: 'Millilitre',
        shortName: 'ml',
      });
    });

    expect(await screen.findByText('Millilitre')).toBeInTheDocument();
    expect(screen.getByText('ml')).toBeInTheDocument();
    expect(screen.getByText(/created successfully/i)).toBeInTheDocument();
  });

  it('edits an existing unit', async () => {
    const updatedUnit: UnitOfMeasure = {
      ...mockUnits[0],
      name: 'Kilo Gram',
      shortName: 'KG',
    };
    mocks.updateUnit.mockResolvedValue(updatedUnit);

    render(
      <MemoryRouter>
        <UnitMasterPage />
      </MemoryRouter>
    );

    await screen.findByText('Kilogram');

    // Find Edit button for Kilogram row
    const editButtons = screen.getAllByRole('button', { name: /Edit/i });
    fireEvent.click(editButtons[0]);

    expect(screen.getByText('Edit Unit of Measure')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Kilogram')).toBeInTheDocument();
    expect(screen.getByDisplayValue('kg')).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText(/Unit Name/i), { target: { value: 'Kilo Gram' } });
    fireEvent.change(screen.getByLabelText(/Short Name/i), { target: { value: 'KG' } });

    fireEvent.click(screen.getByRole('button', { name: /Save Changes/i }));

    await waitFor(() => {
      expect(mocks.updateUnit).toHaveBeenCalledWith(1, {
        name: 'Kilo Gram',
        shortName: 'KG',
      });
    });

    expect(await screen.findByText('Kilo Gram')).toBeInTheDocument();
    expect(screen.getByText('KG')).toBeInTheDocument();
    expect(screen.getByText(/updated successfully/i)).toBeInTheDocument();
  });

  it('handles deactivate and activate status confirmation flows without deleting data', async () => {
    const deactivatedKg: UnitOfMeasure = {
      ...mockUnits[0],
      active: false,
    };
    mocks.updateUnitStatus.mockResolvedValue(deactivatedKg);

    render(
      <MemoryRouter>
        <UnitMasterPage />
      </MemoryRouter>
    );

    await screen.findByText('Kilogram');

    // Find Deactivate button for Kilogram (first row)
    const deactivateBtns = screen.getAllByRole('button', { name: 'Deactivate' });
    fireEvent.click(deactivateBtns[0]);

    // Confirmation dialog appears
    expect(screen.getByText('Deactivate Unit')).toBeInTheDocument();
    expect(
      screen.getByText(/Deactivated units cannot be assigned to new products/i)
    ).toBeInTheDocument();

    // Confirm
    const confirmBtn = screen.getByRole('button', { name: 'Yes, Deactivate' });
    fireEvent.click(confirmBtn);

    await waitFor(() => {
      expect(mocks.updateUnitStatus).toHaveBeenCalledWith(1, false);
    });

    expect(await screen.findByText(/deactivated successfully/i)).toBeInTheDocument();
  });
});
