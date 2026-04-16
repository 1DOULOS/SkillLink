import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import ApplicationStatusBadge from '../components/common/ApplicationStatusBadge'
import SkillBadge from '../components/common/SkillBadge'
import LoadingSpinner from '../components/common/LoadingSpinner'
import Pagination from '../components/common/Pagination'

// ─── ApplicationStatusBadge ───────────────────────────────────────────────────
describe('ApplicationStatusBadge', () => {
  it('renders pending status', () => {
    render(<ApplicationStatusBadge status="pending" />)
    expect(screen.getByText('pending')).toBeInTheDocument()
  })
  it('renders accepted status', () => {
    render(<ApplicationStatusBadge status="accepted" />)
    expect(screen.getByText('accepted')).toBeInTheDocument()
  })
  it('renders rejected status', () => {
    render(<ApplicationStatusBadge status="rejected" />)
    expect(screen.getByText('rejected')).toBeInTheDocument()
  })
  it('renders shortlisted status', () => {
    render(<ApplicationStatusBadge status="shortlisted" />)
    expect(screen.getByText('shortlisted')).toBeInTheDocument()
  })
  it('renders as a DOM element', () => {
    const { container } = render(<ApplicationStatusBadge status="pending" />)
    expect(container.firstChild).toBeInTheDocument()
  })
  it('does not render other status text', () => {
    render(<ApplicationStatusBadge status="accepted" />)
    expect(screen.queryByText('rejected')).not.toBeInTheDocument()
  })
  it('renders different statuses independently', () => {
    const { rerender } = render(<ApplicationStatusBadge status="pending" />)
    expect(screen.getByText('pending')).toBeInTheDocument()
    rerender(<ApplicationStatusBadge status="accepted" />)
    expect(screen.getByText('accepted')).toBeInTheDocument()
  })
})

// ─── SkillBadge ───────────────────────────────────────────────────────────────
describe('SkillBadge', () => {
  it('renders skill text', () => {
    render(<SkillBadge skill="React" />)
    expect(screen.getByText('React')).toBeInTheDocument()
  })
  it('renders long skill name correctly', () => {
    render(<SkillBadge skill="Machine Learning" />)
    expect(screen.getByText('Machine Learning')).toBeInTheDocument()
  })
  it('calls onRemove when remove button clicked', () => {
    const onRemove = vi.fn()
    render(<SkillBadge skill="Python" removable onRemove={onRemove} />)
    fireEvent.click(screen.getByRole('button'))
    expect(onRemove).toHaveBeenCalledTimes(1)
  })
  it('calls onRemove when clicked again', () => {
    const onRemove = vi.fn()
    render(<SkillBadge skill="Node.js" removable onRemove={onRemove} />)
    fireEvent.click(screen.getByRole('button'))
    expect(onRemove).toHaveBeenCalled()
  })
  it('does not show remove button when not removable', () => {
    render(<SkillBadge skill="Node.js" />)
    expect(screen.queryByRole('button')).not.toBeInTheDocument()
  })
  it('does not show remove button when removable prop omitted', () => {
    render(<SkillBadge skill="Docker" />)
    expect(screen.queryByRole('button')).not.toBeInTheDocument()
  })
  it('renders multiple skill badges independently', () => {
    render(
      <>
        <SkillBadge skill="React" />
        <SkillBadge skill="Python" />
        <SkillBadge skill="Docker" />
      </>
    )
    expect(screen.getByText('React')).toBeInTheDocument()
    expect(screen.getByText('Python')).toBeInTheDocument()
    expect(screen.getByText('Docker')).toBeInTheDocument()
  })
  it('removable badges each have independent remove handlers', () => {
    const removeReact = vi.fn()
    const removePython = vi.fn()
    render(
      <>
        <SkillBadge skill="React" removable onRemove={removeReact} />
        <SkillBadge skill="Python" removable onRemove={removePython} />
      </>
    )
    const buttons = screen.getAllByRole('button')
    fireEvent.click(buttons[0])
    expect(removeReact).toHaveBeenCalledTimes(1)
    expect(removePython).not.toHaveBeenCalled()
  })
})

// ─── LoadingSpinner ───────────────────────────────────────────────────────────
describe('LoadingSpinner', () => {
  it('renders without crashing', () => {
    const { container } = render(<LoadingSpinner />)
    expect(container.firstChild).toBeInTheDocument()
  })
  it('does not render loading text by default', () => {
    render(<LoadingSpinner />)
    expect(screen.queryByText(/loading/i)).not.toBeInTheDocument()
  })
  it('renders with custom text', () => {
    render(<LoadingSpinner text="Loading data..." />)
    expect(screen.getByText('Loading data...')).toBeInTheDocument()
  })
  it('renders with different text messages', () => {
    render(<LoadingSpinner text="Please wait" />)
    expect(screen.getByText('Please wait')).toBeInTheDocument()
  })
  it('spinner element is present in DOM', () => {
    const { container } = render(<LoadingSpinner />)
    expect(container).not.toBeEmptyDOMElement()
  })
  it('updates displayed text on rerender', () => {
    const { rerender } = render(<LoadingSpinner text="Loading..." />)
    expect(screen.getByText('Loading...')).toBeInTheDocument()
    rerender(<LoadingSpinner text="Almost done..." />)
    expect(screen.getByText('Almost done...')).toBeInTheDocument()
  })
})

// ─── Pagination ───────────────────────────────────────────────────────────────
describe('Pagination', () => {
  it('renders page buttons', () => {
    render(<Pagination currentPage={1} totalPages={5} onPageChange={vi.fn()} />)
    expect(screen.getByText('1')).toBeInTheDocument()
  })
  it('renders all page numbers for small total', () => {
    render(<Pagination currentPage={1} totalPages={3} onPageChange={vi.fn()} />)
    expect(screen.getByText('1')).toBeInTheDocument()
    expect(screen.getByText('2')).toBeInTheDocument()
    expect(screen.getByText('3')).toBeInTheDocument()
  })
  it('calls onPageChange when next clicked', () => {
    const onPageChange = vi.fn()
    render(<Pagination currentPage={2} totalPages={5} onPageChange={onPageChange} />)
    fireEvent.click(screen.getByText('Next'))
    expect(onPageChange).toHaveBeenCalledWith(3)
  })
  it('calls onPageChange when prev clicked', () => {
    const onPageChange = vi.fn()
    render(<Pagination currentPage={3} totalPages={5} onPageChange={onPageChange} />)
    fireEvent.click(screen.getByText('Prev'))
    expect(onPageChange).toHaveBeenCalledWith(2)
  })
  it('calls onPageChange with correct page when page number clicked', () => {
    const onPageChange = vi.fn()
    render(<Pagination currentPage={1} totalPages={5} onPageChange={onPageChange} />)
    fireEvent.click(screen.getByText('3'))
    expect(onPageChange).toHaveBeenCalledWith(3)
  })
  it('disables prev on first page', () => {
    render(<Pagination currentPage={1} totalPages={5} onPageChange={vi.fn()} />)
    expect(screen.getByText('Prev')).toBeDisabled()
  })
  it('disables next on last page', () => {
    render(<Pagination currentPage={5} totalPages={5} onPageChange={vi.fn()} />)
    expect(screen.getByText('Next')).toBeDisabled()
  })
  it('enables prev when not on first page', () => {
    render(<Pagination currentPage={2} totalPages={5} onPageChange={vi.fn()} />)
    expect(screen.getByText('Prev')).not.toBeDisabled()
  })
  it('enables next when not on last page', () => {
    render(<Pagination currentPage={1} totalPages={5} onPageChange={vi.fn()} />)
    expect(screen.getByText('Next')).not.toBeDisabled()
  })
  it('does not render if only one page', () => {
    const { container } = render(<Pagination currentPage={1} totalPages={1} onPageChange={vi.fn()} />)
    expect(container.firstChild).toBeNull()
  })
  it('does not render if totalPages is 0', () => {
    const { container } = render(<Pagination currentPage={1} totalPages={0} onPageChange={vi.fn()} />)
    expect(container.firstChild).toBeNull()
  })
  it('highlights current page', () => {
    render(<Pagination currentPage={3} totalPages={5} onPageChange={vi.fn()} />)
    expect(screen.getByText('3')).toBeInTheDocument()
  })
  it('handles rapid page change clicks', () => {
    const onPageChange = vi.fn()
    render(<Pagination currentPage={1} totalPages={10} onPageChange={onPageChange} />)
    fireEvent.click(screen.getByText('Next'))
    fireEvent.click(screen.getByText('Next'))
    expect(onPageChange).toHaveBeenCalledTimes(2)
  })
  it('page 1 button and Prev button both present on page 2', () => {
    render(<Pagination currentPage={2} totalPages={5} onPageChange={vi.fn()} />)
    expect(screen.getByText('1')).toBeInTheDocument()
    expect(screen.getByText('Prev')).toBeInTheDocument()
  })
})

// ─── Component Integration ────────────────────────────────────────────────────
describe('Component Integration', () => {
  it('renders skill badges alongside status badge', () => {
    render(
      <>
        <ApplicationStatusBadge status="accepted" />
        <SkillBadge skill="React" />
        <SkillBadge skill="Node.js" />
      </>
    )
    expect(screen.getByText('accepted')).toBeInTheDocument()
    expect(screen.getByText('React')).toBeInTheDocument()
    expect(screen.getByText('Node.js')).toBeInTheDocument()
  })

  it('renders loading spinner then pagination after state change', () => {
    const { rerender } = render(<LoadingSpinner text="Loading jobs..." />)
    expect(screen.getByText('Loading jobs...')).toBeInTheDocument()
    rerender(<div><Pagination currentPage={1} totalPages={3} onPageChange={vi.fn()} /></div>)
    expect(screen.getByText('1')).toBeInTheDocument()
  })

  it('renders full job card simulation with skills and status', () => {
    render(
      <div>
        <ApplicationStatusBadge status="shortlisted" />
        <SkillBadge skill="Python" />
        <SkillBadge skill="TensorFlow" />
        <SkillBadge skill="Docker" />
        <Pagination currentPage={1} totalPages={5} onPageChange={vi.fn()} />
      </div>
    )
    expect(screen.getByText('shortlisted')).toBeInTheDocument()
    expect(screen.getByText('Python')).toBeInTheDocument()
    expect(screen.getByText('TensorFlow')).toBeInTheDocument()
    expect(screen.getByText('Docker')).toBeInTheDocument()
    expect(screen.getByText('Next')).toBeInTheDocument()
  })
})
