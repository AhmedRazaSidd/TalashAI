import { createSlice } from '@reduxjs/toolkit'
const casesSlice = createSlice({
  name: 'cases',
  initialState: {
    cases: [],
    currentCase: null,
    loading: false,
    agentLogs: []
  },
  reducers: {
    setCurrentCase: (state, action) => { state.currentCase = action.payload },
    addAgentLog: (state, action) => { state.agentLogs.push(action.payload) },
    setLoading: (state, action) => { state.loading = action.payload },
    setCases: (state, action) => { state.cases = action.payload }
  }
})
export const { setCurrentCase, addAgentLog, setLoading, setCases } = casesSlice.actions
export default casesSlice.reducer
