import asyncio
import os
os.environ['COGNEE_SYSTEM_PATH'] = os.path.expanduser('~/.cognee_system')
import cognee
async def main():
    await cognee.config.system_root_directory(os.path.expanduser('~/.cognee_system'))
    await cognee.config.data_root_directory(os.path.expanduser('~/.cognee_system/data'))
    print('Starting cognify...')
    await cognee.cognify(datasets=['main_dataset'])
    print('Finished!')

asyncio.run(main())
