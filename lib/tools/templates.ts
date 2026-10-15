export interface DmTemplate { id: string; category: string; title: string; body: string }
export const DM_CATEGORIES = ["Welcome", "Price & product", "Links & lead magnets", "Booking", "Follow-up", "Giveaways"]

/** Variables: {name} {business} {link} {keyword} {offer} {price} {time} */
export const DM_TEMPLATES: DmTemplate[] = [
  { id: "w1", category: "Welcome", title: "First message", body: "Hi {name}! Thanks for messaging {business}. How can I help you today?" },
  { id: "w2", category: "Welcome", title: "New follower", body: "Hi {name}, welcome to {business}! Here is what we do: {offer}. Reply with what you are looking for and I will point you to the right place." },
  { id: "w3", category: "Welcome", title: "Outside working hours", body: "Hi {name}, thanks for your message. We are away right now and reply between {time}. Leave your question and we will get back to you." },
  { id: "p1", category: "Price & product", title: "Price enquiry", body: "Hi {name}! {offer} starts at {price}. Want me to send the full details and options?" },
  { id: "p2", category: "Price & product", title: "Product details", body: "Thanks for asking, {name}! Here are the details and photos: {link}. Tell me your size or preference and I will check availability." },
  { id: "p3", category: "Price & product", title: "Order status", body: "Hi {name}, please share your order number and the phone number used to order. We will check the status for you right away." },
  { id: "l1", category: "Links & lead magnets", title: "Comment keyword reply", body: "Hi {name}! Thanks for commenting {keyword}. Here is your link: {link}" },
  { id: "l2", category: "Links & lead magnets", title: "Free guide", body: "Hi {name}! Here is the free guide you asked for: {link}. If you have questions after reading it, just reply here." },
  { id: "l3", category: "Links & lead magnets", title: "Ask before sending", body: "Hi {name}, thanks for commenting {keyword}! Reply YES and I will send the link here." },
  { id: "b1", category: "Booking", title: "Book a call", body: "Hi {name}! You can pick a time that suits you here: {link}. Reply if none of the slots work and we will find another." },
  { id: "b2", category: "Booking", title: "Qualify the lead", body: "Thanks for your interest, {name}! Two quick questions so I can help properly: 1) What do you want to achieve? 2) What is your timeline?" },
  { id: "b3", category: "Booking", title: "Appointment reminder", body: "Hi {name}, a quick reminder about your appointment with {business} at {time}. Reply here if you need to change it." },
  { id: "f1", category: "Follow-up", title: "Gentle nudge", body: "Hi {name}, just checking in. Did you get a chance to look at {link}? Happy to answer any questions." },
  { id: "f2", category: "Follow-up", title: "After purchase", body: "Thank you for choosing {business}, {name}! If anything is not right, message me here and I will fix it." },
  { id: "f3", category: "Follow-up", title: "Ask for a review", body: "Hi {name}, thanks for buying from {business}! If you enjoyed it, a short review helps us a lot: {link}" },
  { id: "g1", category: "Giveaways", title: "Entry confirmation", body: "You are in, {name}! Thanks for entering the {business} giveaway. Winners will be announced on {time}. Good luck!" },
  { id: "g2", category: "Giveaways", title: "Winner message", body: "Congratulations {name}! You won the {business} giveaway. Reply here with your delivery details to claim your prize." },
]

export function fillTemplate(body: string, vars: Record<string, string>): string {
  return body.replace(/\{(\w+)\}/g, (m, k) => (vars[k] && vars[k].trim() ? vars[k].trim() : m))
}
