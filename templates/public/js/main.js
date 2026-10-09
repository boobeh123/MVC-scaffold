/**************************************************************
DOM selectors
***************************************************************/
const forms = document.querySelectorAll('form');

/**************************************************************
Helper functions
***************************************************************/
const setSubmitDisabled = (form, isDisabled) => {
  const submitButton = form.querySelector('[type="submit"]');
  if (submitButton) submitButton.disabled = isDisabled;
};

/**************************************************************
Handler functions
***************************************************************/
// Stop double submits (two accounts, two posts) from an impatient double click
const handleSubmit = (event) => {
  setSubmitDisabled(event.target, true);
};

// The back button can restore a page with its buttons still disabled; turn them back on
const handlePageShow = () => {
  forms.forEach((form) => setSubmitDisabled(form, false));
};

/**************************************************************
Event listeners
***************************************************************/
forms.forEach((form) => form.addEventListener('submit', handleSubmit));
window.addEventListener('pageshow', handlePageShow);
