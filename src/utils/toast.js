import Swal from 'sweetalert2'

const Toast = Swal.mixin({
  toast: true,
  position: 'top-end',
  showConfirmButton: false,
  timer: 3200,
  timerProgressBar: true,
  customClass: {
    popup: 'app-toast-popup',
    timerProgressBar: 'app-toast-progress',
  },
  didOpen: (toastEl) => {
    toastEl.addEventListener('mouseenter', Swal.stopTimer)
    toastEl.addEventListener('mouseleave', Swal.resumeTimer)
  },
})

export const notifySuccess = (message) => {
  Toast.fire({ icon: 'success', title: message })
}

export const notifyError = (message) => {
  Toast.fire({ icon: 'error', title: message })
}
