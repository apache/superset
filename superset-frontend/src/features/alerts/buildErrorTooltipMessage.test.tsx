import { render, screen } from "spec/helpers/testing-library";
import { buildErrorTooltipMessage } from "./buildErrorTooltipMessage";
import { SectionValidationObject } from "./types";


const noErrors: SectionValidationObject = {
    hasErrors: false,
    errors: [],
    name: 'No Errors'
}

const singleError: SectionValidationObject = {
    hasErrors: true,
    errors: ['first error'],
    name: 'Single Error'
}

const threeErrors: SectionValidationObject = {
    hasErrors: true,
    errors: ['first error', 'second error', 'third error'],
    name: 'Triple Error'
}

const validation = {noErrors, singleError, threeErrors}


test('builds with proper heading', ()=>{
    render(buildErrorTooltipMessage(validation))
    const heading = screen.getByText(/not all required fields are complete\. please provide the following:/i)
    expect(heading).toBeInTheDocument()

})

test('only builds sections that have errors', async ()=>{
    render(buildErrorTooltipMessage(validation))
    const noErrors = screen.queryByText(/no errors: /i)
    const singleError = screen.getByText(/single error:/i)
    const tripleError = screen.getByText(/triple error:/i)
    expect(noErrors).toBeNull()
    expect(singleError).toBeInTheDocument()
    expect(tripleError).toBeInTheDocument()
});

test('properly concatenates errors', async ()=>{
    render(buildErrorTooltipMessage(validation))
    const singleError = screen.getByText(/single error: first error/i)
    const tripleError = screen.getByText(/triple error: first error, second error, third error/i)
    expect(singleError).toBeInTheDocument()
    expect(tripleError).toBeInTheDocument()
});

