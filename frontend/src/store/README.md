# Redux Store Documentation

This directory contains the Redux store configuration for the application using Redux Toolkit.

## Structure

```
store/
├── store.ts           # Store configuration and root state types
├── hooks.ts           # Typed Redux hooks (useAppDispatch, useAppSelector)
├── index.ts           # Public exports
└── slices/            # Redux slices
    └── uiSlice.ts     # UI state management (sidebar, theme, loading)
```

## Usage

### Using Redux Hooks

Always use the typed hooks instead of the plain Redux hooks:

```typescript
import { useAppDispatch, useAppSelector } from '../../store/hooks';

// In your component
const MyComponent = () => {
  const dispatch = useAppDispatch();
  const sidebarCollapsed = useAppSelector((state) => state.ui.sidebarCollapsed);

  // Dispatch actions
  dispatch(toggleSidebar());
};
```

### Creating a New Slice

1. Create a new file in `slices/` directory:

```typescript
import { createSlice, PayloadAction } from '@reduxjs/toolkit';

interface YourState {
  // Define your state shape
}

const initialState: YourState = {
  // Initial values
};

const yourSlice = createSlice({
  name: 'your-slice',
  initialState,
  reducers: {
    // Define your reducers
    yourAction: (state, action: PayloadAction<YourPayload>) => {
      // Update state
    },
  },
});

export const { yourAction } = yourSlice.actions;
export default yourSlice.reducer;
```

2. Add the reducer to the store in `store.ts`:

```typescript
import yourReducer from './slices/yourSlice';

export const store = configureStore({
  reducer: {
    ui: uiReducer,
    yourSlice: yourReducer,  // Add your reducer
  },
  // ...
});
```

### Available Slices

#### UI Slice (`uiSlice.ts`)

Manages UI-related state including:
- `sidebarCollapsed` (boolean): Sidebar collapsed state
- `theme` ('light' | 'dark'): Application theme
- `loading` (boolean): Global loading state

**Actions:**
- `toggleSidebar()`: Toggles the sidebar collapsed state
- `setSidebarCollapsed(boolean)`: Sets the sidebar collapsed state
- `setTheme('light' | 'dark')`: Sets the application theme
- `setLoading(boolean)`: Sets the global loading state

**Example:**
```typescript
import { toggleSidebar, setTheme } from '../../store/slices/uiSlice';

const dispatch = useAppDispatch();
dispatch(toggleSidebar());
dispatch(setTheme('dark'));
```

## Best Practices

1. **Use Typed Hooks**: Always use `useAppDispatch` and `useAppSelector` instead of plain `useDispatch` and `useSelector`.

2. **Keep Slices Focused**: Each slice should handle a specific domain of state (e.g., UI, user, data).

3. **Use PayloadAction**: When creating actions with payloads, use `PayloadAction<T>` for type safety.

4. **Async Operations**: Use Redux Toolkit's `createAsyncThunk` for async operations:
   ```typescript
   export const fetchData = createAsyncThunk(
     'slice/fetchData',
     async (params: Params) => {
       const response = await api.getData(params);
       return response.data;
     }
   );
   ```

5. **Selectors**: For complex state selections, create reusable selectors:
   ```typescript
   export const selectSidebarCollapsed = (state: RootState) => state.ui.sidebarCollapsed;
   ```
