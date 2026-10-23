export interface TimeSlot {
  id: number
  date: string
  startTime: string
  durationMinutes: number
  isBooked: boolean
  doctorId: number | null
}

export interface Booking {
  id: number
  slotId: number
  patientName: string
  patientEmail: string
  createdAt: string
  description: string
}

export interface CreateSlotInput {
  date: string
  startTime: string
  durationMinutes: number
  doctorId: number
}

export interface CreateBookingInput {
  slotId: number
  patientName: string
  patientEmail: string
  description: string
}

