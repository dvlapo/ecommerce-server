export const emailTemplates = {
  orderConfirmed: {
    subject: 'Your order has been confirmed',
    text: `Hi {{customerName}},

Your order {{orderId}} has been confirmed.

Total: {{totalAmount}}

Thank you for shopping with us.`,
    html: `
      <p>Hi {{customerName}},</p>
      <p>Your order <strong>{{orderId}}</strong> has been confirmed.</p>
      <p>Total: <strong>{{totalAmount}}</strong></p>
      <p>Thank you for shopping with us.</p>
    `,
  },
  paymentSuccessful: {
    subject: 'Payment successful',
    text: `Hi {{customerName}},

Your payment for order {{orderId}} was successful.

Amount paid: {{totalAmount}}
Reference: {{reference}}

Thank you for shopping with us.`,
    html: `
      <p>Hi {{customerName}},</p>
      <p>Your payment for order <strong>{{orderId}}</strong> was successful.</p>
      <p>Amount paid: <strong>{{totalAmount}}</strong></p>
      <p>Reference: <strong>{{reference}}</strong></p>
      <p>Thank you for shopping with us.</p>
    `,
  },
  orderShipped: {
    subject: 'Your order has shipped',
    text: `Hi {{customerName}},

Your order {{orderId}} has shipped.

You can check your order page for the latest status.`,
    html: `
      <p>Hi {{customerName}},</p>
      <p>Your order <strong>{{orderId}}</strong> has shipped.</p>
      <p>You can check your order page for the latest status.</p>
    `,
  },
};
