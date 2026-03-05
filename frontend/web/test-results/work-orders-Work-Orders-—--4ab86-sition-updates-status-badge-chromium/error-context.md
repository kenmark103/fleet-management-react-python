# Page snapshot

```yaml
- generic [ref=e4]:
  - generic [ref=e5]:
    - img [ref=e7]
    - heading "Fleet Manager" [level=1] [ref=e12]
    - paragraph [ref=e13]: Sign in to your account
  - generic [ref=e14]:
    - generic [ref=e15]:
      - generic [ref=e16]: Welcome back
      - generic [ref=e17]: Enter your credentials to continue
    - generic [ref=e18]:
      - generic [ref=e19]:
        - alert [ref=e20]:
          - img [ref=e21]
          - generic [ref=e23]: Incorrect email or password
        - generic [ref=e24]:
          - generic [ref=e25]: Email
          - textbox "Email" [ref=e26]:
            - /placeholder: you@example.com
            - text: rashida@fleetms.com
        - generic [ref=e27]:
          - generic [ref=e28]:
            - generic [ref=e29]: Password
            - link "Forgot password?" [ref=e30] [cursor=pointer]:
              - /url: /forgot-password
          - textbox "Password" [ref=e31]:
            - /placeholder: ••••••••
            - text: "12345678"
      - generic [ref=e32]:
        - button "Sign in" [ref=e33]
        - generic [ref=e38]: or
        - button "Continue with Google" [ref=e39]:
          - img
          - text: Continue with Google
```