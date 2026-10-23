export const SPECIALITIES = [
  'Neurolog',
  'Dermatolog',
  'Stomatolog',
  'Kardiolog',
  'Urolog',
  'Ortoped',
] as const

export type Speciality = (typeof SPECIALITIES)[number]

export type Doctor = {
  id: number
  fullName: string
  speciality: Speciality
}

export const DOCTORS: Doctor[] = [
  { id: 1, fullName: 'Marko Gonev', speciality: 'Neurolog' },
  { id: 2, fullName: 'Kiril Trajcev', speciality: 'Neurolog' },
  { id: 3, fullName: 'Teodor Dimitrievski', speciality: 'Neurolog' },

  { id: 4, fullName: 'Anastasija Paneva', speciality: 'Dermatolog' },
  { id: 5, fullName: 'Melanija Gosheva', speciality: 'Dermatolog' },
  { id: 6, fullName: 'Petar Panev', speciality: 'Dermatolog' },
  { id: 7, fullName: 'Anastasija Todorova', speciality: 'Dermatolog' },

  { id: 8, fullName: 'Pavel Monev', speciality: 'Stomatolog' },
  { id: 9, fullName: 'Vlatko Petrov', speciality: 'Stomatolog' },

  { id: 10, fullName: 'Pavel Todorov', speciality: 'Kardiolog' },
  { id: 11, fullName: 'Gorjan Panchev', speciality: 'Kardiolog' },
  { id: 12, fullName: 'Pavlina Nikolovska', speciality: 'Kardiolog' },

  { id: 13, fullName: 'Maja Ancheva', speciality: 'Urolog' },
  { id: 14, fullName: 'Nikola Manchev', speciality: 'Urolog' },

  { id: 15, fullName: 'Boban Bobanov', speciality: 'Ortoped' },
  { id: 16, fullName: 'Marija Pavlova', speciality: 'Ortoped' },
  { id: 17, fullName: 'Bojana Dimcheva', speciality: 'Ortoped' },
]


