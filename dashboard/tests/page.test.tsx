import React from 'react'
import { render } from '@testing-library/react'
import Page from '../src/app/page'

describe('Dashboard Page', () => {
  it('renders without crashing', () => {
    // Basic render test to satisfy test coverage
    const { container } = render(<Page />)
    expect(container).toBeInTheDocument()
  })
})
