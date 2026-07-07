import { test, expect } from '@playwright/test'
import { CREDENTIALS } from './helpers'

test.describe('Login flow', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
  })

  test('shows the login form when not authenticated', async ({ page }) => {
    await expect(page.getByText('Welcome back')).toBeVisible()
    await expect(page.getByLabel('Email')).toBeVisible()
  })

  test('logs in as owner and lands on dashboard', async ({ page }) => {
    await page.getByLabel('Email').fill(CREDENTIALS.owner.email)
    await page.getByPlaceholder(/password/i).fill(CREDENTIALS.owner.password)
    await page.getByRole('button', { name: /sign in/i }).click()

    // Owner redirects to /dashboard
    await expect(page).toHaveURL(/\/(home|dashboard)/)
  })

  test('logs in as lead_manager and lands on home', async ({ page }) => {
    await page.getByLabel('Email').fill(CREDENTIALS.lead_manager.email)
    await page.getByPlaceholder(/password/i).fill(CREDENTIALS.lead_manager.password)
    await page.getByRole('button', { name: /sign in/i }).click()

    await expect(page).toHaveURL(/\/home/)
  })

  test('shows error for wrong password', async ({ page }) => {
    await page.getByLabel('Email').fill(CREDENTIALS.owner.email)
    await page.getByPlaceholder(/password/i).fill('WrongPassword')
    await page.getByRole('button', { name: /sign in/i }).click()

    await expect(page.getByText(/invalid email or password/i)).toBeVisible()
  })

  test('shows error for unknown email', async ({ page }) => {
    await page.getByLabel('Email').fill('nobody@example.com')
    await page.getByPlaceholder(/password/i).fill('AnyPass123')
    await page.getByRole('button', { name: /sign in/i }).click()

    await expect(page.getByText(/invalid email or password/i)).toBeVisible()
  })

  test('shows validation error when email is empty', async ({ page }) => {
    await page.getByRole('button', { name: /sign in/i }).click()
    await expect(page.getByText(/please enter your email/i)).toBeVisible()
  })

  test('shows validation error when password is empty', async ({ page }) => {
    await page.getByLabel('Email').fill(CREDENTIALS.owner.email)
    await page.getByRole('button', { name: /sign in/i }).click()
    await expect(page.getByText(/please enter your password/i)).toBeVisible()
  })
})

test.describe('Logout', () => {
  test('logs out and returns to login screen', async ({ page }) => {
    // Login first
    await page.goto('/')
    await page.getByLabel('Email').fill(CREDENTIALS.lead_manager.email)
    await page.getByPlaceholder(/password/i).fill(CREDENTIALS.lead_manager.password)
    await page.getByRole('button', { name: /sign in/i }).click()
    await expect(page).toHaveURL(/\/home/)

    // Find and click logout (in settings or nav)
    await page.goto('/settings')
    await page.getByRole('button', { name: /log out|sign out|logout/i }).click()

    await expect(page.getByText('Welcome back')).toBeVisible()
  })
})
