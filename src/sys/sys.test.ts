import test from 'ava'
import * as sys from 'src/sys'

test('sys/time', t => {
	t.snapshot(sys.time.TIME_TICK_RATE.get())
})
